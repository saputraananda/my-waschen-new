import multer from 'multer';
import jwt from 'jsonwebtoken';
import { mainPool, myWaschenPool } from '../db/pool.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype || '')) {
      cb(new Error('Foto harus berupa jpeg, png, atau webp'));
      return;
    }
    cb(null, true);
  }
});

export const uploadQcPhotos = (req, res, next) => {
  upload.array('photos', 5)(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran foto terlalu besar (maks 6MB per foto).'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'Maksimal 5 foto.'
          : (err.message || 'Gagal membaca foto.');
      return res.status(400).json({ success: false, message });
    }
    return next();
  });
};

function mobileBase() {
  return (process.env.WASCHEN_MOBILE_API_URL || 'http://127.0.0.1:9001').replace(/\/$/, '');
}

function mobileSecret() {
  const secret = process.env.WASCHEN_MOBILE_REALTIME_SECRET;
  if (!secret) {
    const err = new Error('Koneksi Waschen Mobile belum dikonfigurasi');
    err.status = 503;
    throw err;
  }
  return secret;
}

/**
 * Identitas QC diambil dari sesi login POS (JWT), bukan PIN dari body.
 * Token -> users.id -> mst_employee.employee_id -> mst_role (outlet + role).
 */
async function resolveActor(req) {
  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : null;
  if (!token) return null;
  let claims;
  try {
    claims = jwt.verify(token, process.env.SESSION_SECRET || 'waschensecret');
  } catch {
    return null;
  }
  const [userRows] = await mainPool.query(
    `SELECT e.employee_id
     FROM users u
     JOIN mst_employee e ON e.email = u.email
     WHERE u.id = ? LIMIT 1`,
    [claims.userId]
  );
  const employeeId = Number(userRows[0]?.employee_id) || null;
  if (!employeeId) return null;
  const [roleRows] = await myWaschenPool.query(
    'SELECT employee_name, role, outlet_id FROM mst_role WHERE employee_id = ? LIMIT 1',
    [employeeId]
  );
  const outletId = Number(roleRows[0]?.outlet_id) || null;
  if (!outletId) return null;
  return {
    employeeId,
    fullName: String(roleRows[0]?.employee_name || '').trim(),
    role: roleRows[0]?.role || null,
    outletId
  };
}

/** Management (company_id=1) tidak punya mst_role. Mereka hanya boleh melihat QC outlet yang dipilih. */
async function resolveListActor(req) {
  const actor = await resolveActor(req);
  if (actor) return actor;

  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : null;
  if (!token) return null;
  let claims;
  try {
    claims = jwt.verify(token, process.env.SESSION_SECRET || 'waschensecret');
  } catch {
    return null;
  }
  const [userRows] = await mainPool.query(
    `SELECT e.employee_id, e.company_id, e.full_name
     FROM users u
     JOIN mst_employee e ON e.email = u.email
     WHERE u.id = ? LIMIT 1`,
    [claims.userId]
  );
  const row = userRows[0];
  if (Number(row?.company_id) !== 1) return null;
  const outletId = Number(req.query.outlet_id);
  if (!outletId) return null;
  const [outlets] = await myWaschenPool.query(
    'SELECT id FROM mst_outlet WHERE id = ? LIMIT 1',
    [outletId]
  );
  if (!outlets.length) return null;
  return {
    employeeId: Number(row.employee_id) || null,
    fullName: String(row.full_name || '').trim(),
    role: 'Management',
    outletId
  };
}

async function forwardMobile(path, { json, form } = {}) {
  const headers = { 'X-Realtime-Secret': mobileSecret() };
  let body;
  if (form) {
    body = form;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json || {});
  }
  const res = await fetch(`${mobileBase()}${path}`, { method: 'POST', headers, body });
  const payload = await res.json().catch(() => ({ success: false, message: 'Respons Waschen Mobile tidak valid' }));
  return { status: res.status, payload };
}

const ITEM_SQL = `
  SELECT d.id, d.transaction_id, d.service_name, d.qty, d.unit, d.item_work_status,
         d.has_finding, d.finding_note, d.is_on_hold, d.hold_stage, d.requires_ironing,
         d.fulfillment_type, d.brand, d.color, d.condition_notes,
         cat.code AS category_code
  FROM tr_transaction_detail d
  LEFT JOIN mst_service s ON s.id = d.service_id
  LEFT JOIN mst_service_category cat ON cat.id = s.category_id
  WHERE d.transaction_id IN (?)
`;

export const getQcList = async (req, res) => {
  try {
    const actor = await resolveListActor(req);
    if (!actor) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid atau outlet belum ditetapkan' });
    }
    const { outletId, role } = actor;
    const tab = req.query.tab === 'delivery' ? 'delivery' : 'frontliner';
    const search = String(req.query.search || '').trim().slice(0, 40);

    const isDeliveryStaff = /delivery/i.test(String(role || ''));
    // Tim delivery default lihat nota pickup saja; filter tetap bisa dibuka ke 'all'
    const pickup = ['all', 'delivery', 'outlet'].includes(req.query.pickup)
      ? req.query.pickup
      : (isDeliveryStaff ? 'delivery' : 'all');

    const statuses = tab === 'delivery' ? ['Siap Diantar', 'Sedang Diantar'] : ['Antrean'];
    const params = [outletId, ...statuses];
    let extra = '';
    if (tab === 'delivery' || pickup === 'delivery') {
      extra += ` AND d.fulfillment_type = 'Delivery_Kurir'`;
    } else if (pickup === 'outlet') {
      extra += ` AND d.fulfillment_type <> 'Delivery_Kurir'`;
    }
    if (search) {
      extra += ` AND (t.order_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [txns] = await myWaschenPool.query(
      `SELECT DISTINCT t.id, t.order_no, t.order_date, t.payment_status, t.outlet_id,
              c.name AS customer_name, c.phone AS customer_phone
       FROM tr_transaction t
       JOIN tr_transaction_detail d ON d.transaction_id = t.id
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       WHERE t.outlet_id = ?
         AND d.item_work_status IN (${statuses.map(() => '?').join(',')})
         AND COALESCE(d.item_work_status, '') != 'Dibatalkan'
         ${extra}
       ORDER BY t.order_date ASC
       LIMIT 80`,
      params
    );

    let items = [];
    if (txns.length) {
      const [detailRows] = await myWaschenPool.query(ITEM_SQL, [txns.map((t) => t.id)]);
      items = detailRows;
    }

    let holds = [];
    if (tab === 'frontliner') {
      const [holdRows] = await myWaschenPool.query(
        `SELECT d.id AS detail_id, d.service_name, d.qty, d.unit, d.finding_note, d.item_work_status,
                t.order_no, c.name AS customer_name, c.phone AS customer_phone,
                cat.code AS category_code,
                p.id AS hold_id, p.notes AS report_notes, p.stage AS reported_stage,
                p.employee_name AS reported_by, p.created_at AS reported_at
         FROM tr_transaction_detail d
         JOIN tr_transaction t ON t.id = d.transaction_id
         LEFT JOIN mst_customer c ON c.id = t.customer_id
         LEFT JOIN mst_service s ON s.id = d.service_id
         LEFT JOIN mst_service_category cat ON cat.id = s.category_id
         JOIN tr_item_progress p ON p.transaction_detail_id = d.id
           AND p.status IN ('hold','returned') AND p.hold_resolved_at IS NULL
         WHERE d.is_on_hold = 1 AND t.outlet_id = ?
           AND COALESCE(p.returned_to_stage, p.stage) = 'frontliner'
         ORDER BY p.created_at ASC`,
        [outletId]
      );

      // Foto bukti temuan tersimpan di server Waschen Mobile -> URL absolut ke sana
      let photos = [];
      if (holdRows.length) {
        const [photoRows] = await myWaschenPool.query(
          'SELECT progress_id, photo_path FROM tr_item_progress_photo WHERE progress_id IN (?) ORDER BY id ASC',
          [holdRows.map((h) => h.hold_id)]
        );
        photos = photoRows.map((p, i) => ({
          id: `${p.progress_id}-${i}`,
          progress_id: p.progress_id,
          photo_url: `${mobileBase()}${String(p.photo_path || '').startsWith('/') ? '' : '/'}${p.photo_path}`
        }));
      }

      holds = holdRows.map((h) => ({
        ...h,
        photos: photos.filter((p) => p.progress_id === h.hold_id)
      }));
    }

    const data = txns.map((t) => ({
      ...t,
      items: items.filter((d) => d.transaction_id === t.id && d.item_work_status !== 'Dibatalkan')
    }));

    return res.json({
      success: true,
      data,
      holds,
      outletId,
      role,
      pickup
    });
  } catch (error) {
    console.error('getQcList:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar QC' });
  }
};

export const submitPosQc = async (req, res) => {
  try {
    const actor = await resolveActor(req);
    if (!actor) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid, silakan login ulang' });
    }

    const fd = new FormData();
    fd.append('employee_id', String(actor.employeeId));
    for (const key of [
      'transaction_detail_id', 'stage', 'qc_status', 'qc_decision', 'returned_to_stage',
      'notes', 'wa_contacted', 'requires_ironing', 'bags', 'packings'
    ]) {
      const value = req.body?.[key];
      if (value != null && String(value) !== '') fd.append(key, String(value));
    }
    for (const file of req.files || []) {
      fd.append(
        'photos',
        new Blob([file.buffer], { type: file.mimetype || 'image/jpeg' }),
        file.originalname || 'qc.jpg'
      );
    }

    const result = await forwardMobile('/api/realtime/progress-qc', { form: fd });
    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error('submitPosQc:', error);
    const status = error.status || 502;
    return res.status(status).json({
      success: false,
      message: status === 503 ? error.message : 'Gagal menyimpan QC ke Waschen Mobile'
    });
  }
};

export const resolvePosHold = async (req, res) => {
  try {
    const actor = await resolveActor(req);
    if (!actor) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid, silakan login ulang' });
    }
    const detailId = Number(req.body?.detailId);
    const decision = req.body?.decision;
    if (!detailId) return res.status(422).json({ success: false, message: 'Item tidak valid' });
    if (!['lanjut', 'batal'].includes(decision)) {
      return res.status(422).json({ success: false, message: 'Keputusan tidak valid' });
    }
    const result = await forwardMobile('/api/realtime/progress-hold-resolve', {
      json: {
        employee_id: actor.employeeId,
        detailId,
        decision,
        note: req.body?.note || ''
      }
    });
    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error('resolvePosHold:', error);
    const status = error.status || 502;
    return res.status(status).json({
      success: false,
      message: status === 503 ? error.message : 'Gagal menyelesaikan konfirmasi'
    });
  }
};
