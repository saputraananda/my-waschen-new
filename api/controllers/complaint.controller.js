import { myWaschenPool } from '../db/pool.js';
import mysql from 'mysql2/promise';

let smartlinkPool;
function getSmartlinkPool() {
  if (smartlinkPool) return smartlinkPool;
  if (!process.env.DB_HOST_SMARTLINK || !process.env.DB_NAME_SMARTLINK) return null;
  smartlinkPool = mysql.createPool({
    host: process.env.DB_HOST_SMARTLINK,
    port: parseInt(process.env.DB_PORT_SMARTLINK || '3306', 10),
    user: process.env.DB_USER_SMARTLINK,
    password: process.env.DB_PASS_SMARTLINK,
    database: process.env.DB_NAME_SMARTLINK,
    connectTimeout: 10000,
    connectionLimit: 3
  });
  return smartlinkPool;
}

export async function getComplaintMeta(_req, res) {
  try {
    const [types] = await myWaschenPool.query(
      'SELECT type_id, type_name FROM mst_complaint_type WHERE is_active = 1 ORDER BY sort_order, type_id'
    );
    const [categories] = await myWaschenPool.query(
      'SELECT category_id, category_name FROM mst_complaint_category WHERE is_active = 1 ORDER BY sort_order, category_id'
    );
    const [topics] = await myWaschenPool.query(
      'SELECT topic_id, topic_name FROM mst_complaint_topic WHERE is_active = 1 ORDER BY sort_order, topic_id'
    );
    return res.json({ success: true, data: { types, categories, topics } });
  } catch (err) {
    console.error('getComplaintMeta:', err.message);
    return res.status(500).json({ success: false, message: 'Gagal memuat master komplain' });
  }
}

/** Nota dari myWaschen.tr_transaction dan rekap Smartlink (pola Alsa). */
export async function searchComplaintNota(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: [] });
    const like = `%${q}%`;

    const [pos] = await myWaschenPool.query(
      `SELECT t.order_no AS no_nota, c.name AS customer_nama
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       WHERE t.order_no LIKE ? OR c.name LIKE ?
       ORDER BY t.id DESC
       LIMIT 20`,
      [like, like]
    );

    let legacy = [];
    const sl = getSmartlinkPool();
    if (sl) {
      try {
        const [rows] = await sl.query(
          `SELECT no_nota, customer_nama
           FROM rekap_transaksi_reguler
           WHERE no_nota LIKE ?
           GROUP BY no_nota, customer_nama
           ORDER BY no_nota ASC
           LIMIT 20`,
          [like]
        );
        legacy = rows;
      } catch (err) {
        console.error('searchComplaintNota smartlink:', err.message);
      }
    }

    const seen = new Set();
    const data = [];
    for (const row of [...pos, ...legacy]) {
      const key = String(row.no_nota || '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      data.push({ no_nota: key, customer_nama: row.customer_nama || '' });
      if (data.length >= 20) break;
    }
    return res.json({ success: true, data });
  } catch (err) {
    console.error('searchComplaintNota:', err.message);
    return res.status(500).json({ success: false, message: 'Gagal mencari nota' });
  }
}

/** Item dalam satu nota POS untuk dipilih sebagai objek komplain. */
export async function getComplaintNotaItems(req, res) {
  try {
    const nota = String(req.query.nota || '').trim();
    if (!nota) return res.json({ success: true, data: [] });
    const [rows] = await myWaschenPool.query(
      `SELECT d.id, d.service_name, d.qty, d.unit
       FROM tr_transaction_detail d
       JOIN tr_transaction t ON t.id = d.transaction_id
       WHERE t.order_no = ? AND COALESCE(d.item_work_status, '') <> 'Dibatalkan'
       ORDER BY d.id ASC`,
      [nota]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getComplaintNotaItems:', err.message);
    return res.status(500).json({ success: false, message: 'Gagal memuat item nota' });
  }
}

/** Riwayat komplain satu outlet (cabang yang sedang dipilih di POS). */
export async function listOutletComplaints(req, res) {
  try {
    const outletId = Number(req.query.outlet_id || 0);
    if (!outletId) {
      return res.status(400).json({ success: false, message: 'outlet_id wajib' });
    }
    const [rows] = await myWaschenPool.query(
      `SELECT c.complaint_id, c.nota_number, c.complaint_name, c.progress, c.submitted_at, c.created_at
       FROM tr_complaint c
       WHERE c.outlet_id = ?
       ORDER BY c.complaint_id DESC
       LIMIT 200`,
      [outletId]
    );

    // Deteksi sumber nota: tr_transaction = My Waschen, rekap Smartlink = Smartlink
    const notas = [...new Set(rows.map((r) => String(r.nota_number || '').trim()).filter((n) => n && n !== '0'))];
    let posSet = new Set();
    if (notas.length) {
      const [pos] = await myWaschenPool.query(
        `SELECT order_no FROM tr_transaction WHERE order_no IN (${notas.map(() => '?').join(',')})`,
        notas
      );
      posSet = new Set(pos.map((p) => String(p.order_no).trim()));
    }
    let slSet = new Set();
    const rest = notas.filter((n) => !posSet.has(n));
    const sl = getSmartlinkPool();
    if (sl && rest.length) {
      try {
        const [slRows] = await sl.query(
          `SELECT DISTINCT no_nota FROM rekap_transaksi_reguler WHERE no_nota IN (${rest.map(() => '?').join(',')})`,
          rest
        );
        slSet = new Set(slRows.map((r) => String(r.no_nota).trim()));
      } catch (err) {
        console.error('listOutletComplaints smartlink:', err.message);
      }
    }
    const data = rows.map((r) => {
      const nota = String(r.nota_number || '').trim();
      const source = posSet.has(nota) ? 'My Waschen' : slSet.has(nota) ? 'Smartlink' : null;
      return { ...r, source };
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('listOutletComplaints:', err.message);
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat komplain' });
  }
}

/** Detail satu komplain, hanya jika milik outlet yang sedang dipilih. */
export async function getOutletComplaintDetail(req, res) {
  try {
    const id = Number(req.params.id || 0);
    const outletId = Number(req.query.outlet_id || 0);
    if (!id || !outletId) {
      return res.status(400).json({ success: false, message: 'ID dan outlet wajib' });
    }
    const [rows] = await myWaschenPool.query(
      `SELECT
         c.complaint_id, c.nota_number, c.complaint_name, c.qty, c.progress,
         c.description, c.deduction, c.pic_name, c.submitted_at, c.created_at,
         t.type_name, cat.category_name, top.topic_name
       FROM tr_complaint c
       LEFT JOIN mst_complaint_type t ON t.type_id = c.type_id
       LEFT JOIN mst_complaint_category cat ON cat.category_id = c.category_id
       LEFT JOIN mst_complaint_topic top ON top.topic_id = c.topic_id
       WHERE c.complaint_id = ? AND c.outlet_id = ?`,
      [id, outletId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Komplain tidak ditemukan di cabang ini' });
    }
    const [docs] = await myWaschenPool.query(
      `SELECT doc_id, file_path, original_name, mime_type
       FROM tr_complaint_document WHERE complaint_id = ? ORDER BY uploaded_at ASC`,
      [id]
    );
    const [logs] = await myWaschenPool.query(
      `SELECT log_id, progress, note, pic_name, logged_at
       FROM tr_complaint_progress_log WHERE complaint_id = ? ORDER BY logged_at ASC`,
      [id]
    );
    let progressDocs = [];
    if (logs.length) {
      const ids = logs.map((l) => l.log_id);
      const [pd] = await myWaschenPool.query(
        `SELECT log_id, file_path, original_name, mime_type
         FROM tr_complaint_progress_document
         WHERE log_id IN (${ids.map(() => '?').join(',')})
         ORDER BY uploaded_at ASC`,
        ids
      );
      progressDocs = pd;
    }
    return res.json({
      success: true,
      data: {
        ...rows[0],
        documents: docs,
        logs: logs.map((log) => ({
          ...log,
          documents: progressDocs.filter((d) => d.log_id === log.log_id)
        }))
      }
    });
  } catch (err) {
    console.error('getOutletComplaintDetail:', err.message);
    return res.status(500).json({ success: false, message: 'Gagal memuat detail komplain' });
  }
}

/** Pengajuan frontliner. Status awal Request, menunggu approval Alsa. */
export async function createComplaintRequest(req, res) {
  const conn = await myWaschenPool.getConnection();
  try {
    const auth = req.auth || {};
    const typeId = Number(req.body.type_id || 0);
    const categoryId = Number(req.body.category_id || 0);
    const topicId = Number(req.body.topic_id || 0);
    const outletId = Number(req.body.outlet_id || 0);
    const name = String(req.body.complaint_name || '').trim();
    const nota = String(req.body.nota_number || '').trim();
    const qty = Math.max(Number(req.body.qty || 1), 1);
    const description = String(req.body.description || '').trim();
    const userId = Number(auth.userId || 0);
    const employeeId = auth.employeeId ? Number(auth.employeeId) : null;

    if (!typeId || !categoryId || !topicId || !outletId || !name || !nota || !description) {
      return res.status(400).json({ success: false, message: 'Tipe, kategori, topik, outlet, nota, nama, dan kronologi wajib diisi.' });
    }

    await conn.beginTransaction();
    const [ins] = await conn.query(
      `INSERT INTO tr_complaint
         (type_id, category_id, topic_id, outlet_id, complaint_name, nota_number,
          qty, description, deduction, progress, submitted_at,
          created_by_user_id, created_by_employee_id)
       VALUES (?,?,?,?,?,?,?,?,'None','Request',NOW(),?,?)`,
      [typeId, categoryId, topicId, outletId, name, nota, qty, description, userId, employeeId]
    );
    const complaintId = ins.insertId;

    for (const file of req.files || []) {
      await conn.query(
        `INSERT INTO tr_complaint_document (complaint_id, file_path, original_name, mime_type, file_size_kb)
         VALUES (?,?,?,?,?)`,
        [
          complaintId,
          `assets/complaint_docs/${file.filename}`,
          file.originalname,
          file.mimetype,
          Math.round(file.size / 1024)
        ]
      );
    }

    await conn.query(
      `INSERT INTO tr_complaint_progress_log
         (complaint_id, progress, note, logged_by_user_id, logged_by_employee_id)
       VALUES (?,?,?,?,?)`,
      [complaintId, 'Request', 'Pengajuan dari frontliner POS.', userId, employeeId]
    );

    await conn.commit();
    return res.status(201).json({
      success: true,
      message: 'Pengajuan komplain terkirim. Menunggu persetujuan admin.',
      complaint_id: complaintId
    });
  } catch (err) {
    await conn.rollback();
    console.error('createComplaintRequest:', err.message);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan pengajuan' });
  } finally {
    conn.release();
  }
}
