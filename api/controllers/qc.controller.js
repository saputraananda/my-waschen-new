import multer from 'multer';
import jwt from 'jsonwebtoken';
import { getSessionSecret } from '../utils/sessionSecret.js';
import { mainPool, myWaschenPool } from '../db/pool.js';
import { isDropPointOutlet } from '../utils/dropPointOutlet.js';

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

/** Outlet yang sedang dipilih di POS (query / body / header X-Active-Outlet-Id). */
function requestedOutlet(req) {
  return (
    Number(req.query?.outlet_id) ||
    Number(req.body?.outlet_id) ||
    Number(req.body?.outletId) ||
    Number(req.headers?.['x-active-outlet-id']) ||
    null
  );
}

function hasValidToken(req) {
  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : null;
  if (!token) return false;
  try {
    jwt.verify(token, getSessionSecret());
    return true;
  } catch {
    return false;
  }
}

/**
 * 401 hanya bila token memang tidak valid (POS akan logout otomatis).
 * Token valid tapi akun tidak punya role/outlet staf (mis. Manajemen) -> 403, sesi tetap jalan.
 */
function rejectActor(req, res) {
  if (!hasValidToken(req)) {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid, silakan login ulang' });
  }
  return res.status(403).json({
    success: false,
    message: 'Outlet belum ditetapkan. Pilih outlet di header POS untuk melakukan QC.'
  });
}

/**
 * Identitas QC diambil dari sesi login POS (JWT), bukan PIN dari body.
 * Token -> users.id / email / employeeId -> mst_employee -> mst_role (outlet + role).
 */
async function resolveActor(req) {
  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : null;
  if (!token) return null;

  let claims;
  try {
    claims = jwt.verify(token, getSessionSecret());
  } catch {
    return null;
  }

  let employeeId = Number(claims.employeeId) || null;
  let fullName = '';

  if (!employeeId && claims.userId) {
    const [userRows] = await mainPool.query(
      `SELECT e.employee_id, e.full_name
       FROM users u
       JOIN mst_employee e ON LOWER(TRIM(e.email)) = LOWER(TRIM(u.email))
       WHERE u.id = ?
       LIMIT 1`,
      [claims.userId]
    );
    employeeId = Number(userRows[0]?.employee_id) || null;
    fullName = String(userRows[0]?.full_name || '').trim();
  }

  if (!employeeId && claims.email) {
    const [empRows] = await mainPool.query(
      `SELECT employee_id, full_name
       FROM mst_employee
       WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
       LIMIT 1`,
      [claims.email]
    );
    employeeId = Number(empRows[0]?.employee_id) || null;
    fullName = String(empRows[0]?.full_name || '').trim();
  }

  if (!employeeId) return null;

  const [roleRows] = await myWaschenPool.query(
    'SELECT employee_name, role, outlet_id FROM mst_role WHERE employee_id = ? LIMIT 1',
    [employeeId]
  );

  let outletId = Number(roleRows[0]?.outlet_id) || null;
  // Fallback: outlet aktif di POS (kalau mst_role.outlet_id belum diisi)
  const requestedOutletId = requestedOutlet(req);
  if (!outletId) {
    outletId = requestedOutletId;
  }
  // Staf boleh bekerja di outlet Drop Point (pilihan outlet di POS); outlet lain tetap terkunci ke mst_role.
  if (requestedOutletId && requestedOutletId !== outletId && (await isDropPointOutlet(requestedOutletId))) {
    outletId = requestedOutletId;
  }
  if (!outletId) return null;

  // Akun tanpa mst_role (mis. Manajemen): nama dari mst_employee supaya QC tercatat atas namanya
  if (!roleRows[0]?.employee_name && !fullName) {
    const [emp] = await mainPool.query('SELECT full_name FROM mst_employee WHERE employee_id = ? LIMIT 1', [employeeId]);
    fullName = String(emp[0]?.full_name || '').trim();
  }

  return {
    employeeId,
    fullName: String(roleRows[0]?.employee_name || fullName || '').trim(),
    role: roleRows[0]?.role || null,
    outletId
  };
}

/** Management (company_id=1) tidak punya mst_role. Mereka hanya boleh melihat QC outlet yang dipilih. */
async function resolveListActor(req) {
  const actor = await resolveActor(req);
  if (actor) {
    // Staff terikat outlet role; kalau UI kirim outlet lain, tetap pakai outlet role
    return actor;
  }

  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : null;
  if (!token) return null;

  let claims;
  try {
    claims = jwt.verify(token, getSessionSecret());
  } catch {
    return null;
  }

  const [userRows] = await mainPool.query(
    `SELECT e.employee_id, e.company_id, e.full_name
     FROM users u
     LEFT JOIN mst_employee e ON LOWER(TRIM(e.email)) = LOWER(TRIM(u.email))
     WHERE u.id = ?
     LIMIT 1`,
    [claims.userId]
  );
  const row = userRows[0];
  if (Number(row?.company_id) !== 1) return null;

  const outletId = requestedOutlet(req);
  if (!outletId) return null;

  const [outlets] = await myWaschenPool.query(
    'SELECT id FROM mst_outlet WHERE id = ? LIMIT 1',
    [outletId]
  );
  if (!outlets.length) return null;

  return {
    employeeId: Number(row.employee_id) || Number(claims.employeeId) || null,
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
         d.production_outlet_id, po.name AS production_outlet_name,
         t.outlet_id AS txn_outlet_id,
         cat.code AS category_code
  FROM tr_transaction_detail d
  JOIN tr_transaction t ON t.id = d.transaction_id
  LEFT JOIN mst_outlet po ON po.id = d.production_outlet_id
  LEFT JOIN mst_service s ON s.id = d.service_id
  LEFT JOIN mst_service_category cat ON cat.id = s.category_id
  WHERE d.transaction_id IN (?) AND d.is_production = 1
`;

export const getQcList = async (req, res) => {
  try {
    const actor = await resolveListActor(req);
    if (!actor) {
      if (!hasValidToken(req)) {
        return res.status(401).json({ success: false, message: 'Sesi tidak valid, silakan login ulang' });
      }
      return res.status(403).json({
        success: false,
        message: 'Outlet belum ditetapkan. Pastikan akun sudah punya role & outlet, atau pilih outlet di header.'
      });
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
    // Item yang didistribusikan (production_outlet_id terisi) ke outlet ini tapi belum QC awal juga
    // muncul di tab Frontliner (barang bisa tiba di cabang lebih dulu). Outlet nota (drop point)
    // tetap melihatnya lewat t.outlet_id; item tidak didistribusikan dikerjakan di outlet nota.
    const includeAssignedDropPoint = tab === 'frontliner';
    const outletScopeSql = includeAssignedDropPoint
      ? `(t.outlet_id = ? OR d.production_outlet_id = ?)`
      : `t.outlet_id = ?`;
    const params = includeAssignedDropPoint ? [outletId, outletId, ...statuses] : [outletId, ...statuses];
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

    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const fromWhere = `
       FROM tr_transaction t
       JOIN tr_transaction_detail d ON d.transaction_id = t.id
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       WHERE ${outletScopeSql}
         AND d.item_work_status IN (${statuses.map(() => '?').join(',')})
         AND COALESCE(d.item_work_status, '') != 'Dibatalkan'
         ${extra}`;

    const [[{ total }]] = await myWaschenPool.query(
      `SELECT COUNT(DISTINCT t.id) AS total ${fromWhere}`,
      params
    );
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const safePage = Math.min(page, totalPages);

    // Terbaru dulu; t.id sebagai tie-breaker supaya urutan antar halaman stabil
    const [txns] = await myWaschenPool.query(
      `SELECT DISTINCT t.id, t.order_no, t.order_date, t.payment_status, t.outlet_id, t.source,
              (SELECT o.name FROM mst_outlet o WHERE o.id = t.outlet_id AND o.is_drop_point = 1) AS drop_point_name,
              c.name AS customer_name, c.phone AS customer_phone,
              c.address AS customer_street, c.block AS customer_block, c.house_number AS customer_house_number
       ${fromWhere}
       ORDER BY t.order_date DESC, t.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, (safePage - 1) * limit]
    );

    let items = [];
    if (txns.length) {
      const [detailRows] = await myWaschenPool.query(ITEM_SQL, [txns.map((t) => t.id)]);
      // Outlet nota melihat semua item notanya; cabang produksi hanya item yang didistribusikan ke cabangnya
      items = detailRows.filter(
        (d) =>
          d.production_outlet_id == null ||
          Number(d.txn_outlet_id) === outletId ||
          Number(d.production_outlet_id) === outletId
      );
    }

    let holds = [];
    if (tab === 'frontliner') {
      const [holdRows] = await myWaschenPool.query(
        `SELECT d.id AS detail_id, d.service_name, d.qty, d.unit, d.finding_note, d.item_work_status,
                t.order_no, t.source, c.name AS customer_name, c.phone AS customer_phone,
                (SELECT o.name FROM mst_outlet o WHERE o.id = t.outlet_id AND o.is_drop_point = 1) AS drop_point_name,
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
         WHERE d.is_on_hold = 1
           AND (t.outlet_id = ? OR d.production_outlet_id = ?)
           AND COALESCE(p.returned_to_stage, p.stage) = 'frontliner'
         ORDER BY p.created_at ASC`,
        [outletId, outletId]
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
      pagination: { page: safePage, limit, total, totalPages },
      outletId,
      role,
      pickup
    });
  } catch (error) {
    console.error('getQcList:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar QC' });
  }
};

/** GET /api/qc/item-kg — master jenis pakaian kiloan (aktif) untuk rinci opsional Frontliner/Delivery */
export const getItemKgMaster = async (req, res) => {
  try {
    // Master referensi saja: cukup sesi valid (Manajemen juga boleh membuka form QC)
    if (!hasValidToken(req)) {
      return res.status(401).json({ success: false, message: 'Sesi tidak valid, silakan login ulang' });
    }
    const [rows] = await myWaschenPool.query(
      'SELECT id, name FROM mst_item_kg WHERE is_active = 1 ORDER BY sort_order ASC, name ASC'
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getItemKgMaster:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat master jenis pakaian' });
  }
};

export const submitPosQc = async (req, res) => {
  try {
    const actor = await resolveActor(req);
    if (!actor) return rejectActor(req, res);

    const fd = new FormData();
    fd.append('employee_id', String(actor.employeeId));
    // Outlet kerja staf (bisa drop point yang dipilih di header); Waschen Mobile memvalidasi ulang
    fd.append('outlet_id', String(actor.outletId));
    // Nama pengerja (dipakai Waschen Mobile bila karyawan tidak punya mst_role, mis. Manajemen)
    if (actor.fullName) fd.append('employee_name', actor.fullName);
    for (const key of [
      'transaction_detail_id', 'stage', 'qc_status', 'qc_decision', 'returned_to_stage',
      'notes', 'wa_contacted', 'requires_ironing', 'bags', 'packings', 'kg_items'
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
    if (!actor) return rejectActor(req, res);
    const detailId = Number(req.body?.detailId);
    const decision = req.body?.decision;
    if (!detailId) return res.status(422).json({ success: false, message: 'Item tidak valid' });
    if (!['lanjut', 'batal'].includes(decision)) {
      return res.status(422).json({ success: false, message: 'Keputusan tidak valid' });
    }
    const result = await forwardMobile('/api/realtime/progress-hold-resolve', {
      json: {
        employee_id: actor.employeeId,
        outlet_id: actor.outletId,
        employee_name: actor.fullName || '',
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
