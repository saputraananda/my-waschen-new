import path from 'path';
import { myWaschenPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import {
  buildUploadPublicUrl,
  DEPOSIT_REPORT_FRONTLINER_SUBDIR,
  replaceUploadUrl,
  safeUnlinkAbsPath
} from '../middleware/upload.js';
import { getEmployeeNames, formatEmployeeLabel } from '../utils/employeeNames.js';
import { todayWibISO, toWibDateKey } from '../utils/wib.js';
import { isEventOutlet, listEventOutlets } from '../utils/eventOutlet.js';

/**
 * Setoran tunai = bukti setor uang hasil closing Final (tr_cashier_shift.deposit_*).
 * Tidak memblokir open/close shift — hanya dilaporkan di menu Setoran Tunai.
 * Outlet Event tanpa shift: setoran per hari per event (tr_event_deposit), nominal + bukti.
 *
 * Batas wajar: bukti diunggah paling lambat H+1 dari tanggal closing (kalender WIB).
 * Lewat dari itu ditandai terlambat.
 */
export const DEPOSIT_DUE_DAYS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

const dayDiff = (laterKey, earlierKey) => {
  if (!laterKey || !earlierKey) return 0;
  return Math.round((Date.parse(`${laterKey}T00:00:00Z`) - Date.parse(`${earlierKey}T00:00:00Z`)) / DAY_MS);
};

const isDateKey = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

/** Tambahkan status & keterlambatan ke satu baris closing Final. */
const withDepositStatus = (row, nameMap, todayKey) => {
  const closedKey = toWibDateKey(row.closed_at);
  const uploaded = Boolean(row.deposit_proof_url);
  const refKey = uploaded ? toWibDateKey(row.deposit_uploaded_at) || todayKey : todayKey;
  const lateDays = Math.max(0, dayDiff(refKey, closedKey) - DEPOSIT_DUE_DAYS);

  return {
    kind: 'shift',
    key: `shift-${row.id}`,
    sort_at: new Date(row.closed_at).toISOString(),
    id: row.id,
    outlet_id: row.outlet_id,
    outlet_name: row.outlet_full_name || row.outlet_name || `Outlet #${row.outlet_id}`,
    shift_number: row.shift_number,
    opener_name: formatEmployeeLabel(row.cashier_employee_id, nameMap),
    closed_by_name: row.closed_by_employee_id
      ? formatEmployeeLabel(row.closed_by_employee_id, nameMap)
      : null,
    opened_at: row.opened_at,
    closed_at: row.closed_at,
    declared_revenue: row.declared_revenue,
    status: uploaded ? 'uploaded' : 'pending',
    is_late: lateDays > 0,
    late_days: lateDays,
    deposit_proof_url: row.deposit_proof_url,
    deposit_notes: row.deposit_notes,
    deposit_uploaded_at: row.deposit_uploaded_at,
    deposit_uploaded_by: row.deposit_uploaded_by,
    deposit_uploaded_by_name: row.deposit_uploaded_by
      ? formatEmployeeLabel(row.deposit_uploaded_by, nameMap)
      : null
  };
};

const SELECT_FINAL_CLOSING = `
  SELECT s.id, s.outlet_id, s.shift_number, s.cashier_employee_id, s.closed_by_employee_id,
         s.opened_at, s.closed_at, s.declared_revenue,
         s.deposit_proof_url, s.deposit_notes, s.deposit_uploaded_at, s.deposit_uploaded_by,
         o.name AS outlet_name, o.full_name AS outlet_full_name
  FROM tr_cashier_shift s
  LEFT JOIN mst_outlet o ON o.id = s.outlet_id
  WHERE s.status = 'Closed' AND s.close_type = 'Final'`;

const loadShiftRows = async ({ outletId, start, end, todayKey }) => {
  const params = [];
  let sql = SELECT_FINAL_CLOSING;
  if (outletId) {
    sql += ' AND s.outlet_id = ?';
    params.push(outletId);
  }
  if (start) {
    sql += ' AND DATE(s.closed_at) >= ?';
    params.push(start);
  }
  sql += ' AND DATE(s.closed_at) <= ? ORDER BY s.closed_at DESC, s.id DESC';
  params.push(end);

  const [rows] = await myWaschenPool.query(sql, params);
  const nameMap = await getEmployeeNames(rows.flatMap((r) => [
    r.cashier_employee_id,
    r.closed_by_employee_id,
    r.deposit_uploaded_by
  ]));
  return rows.map((r) => withDepositStatus(r, nameMap, todayKey));
};

/**
 * Baris setoran Event: satu per (outlet event, tanggal) yang punya tunai masuk atau sudah ada setoran.
 * Tunai sistem = pembayaran metode Tunai di tr_payment_log untuk nota outlet event.
 */
const loadEventRows = async ({ outletId, start, end, todayKey }) => {
  const events = (await listEventOutlets()).filter((o) => !outletId || Number(o.id) === Number(outletId));
  if (!events.length) return [];
  const ids = events.map((o) => o.id);
  const nameOf = Object.fromEntries(events.map((o) => [Number(o.id), o.full_name || o.name]));
  const marks = ids.map(() => '?').join(',');

  const cashParams = [...ids];
  let cashSql = `SELECT t.outlet_id, DATE_FORMAT(l.created_at, '%Y-%m-%d') AS d, COALESCE(SUM(l.amount), 0) AS cash
     FROM tr_payment_log l
     JOIN tr_transaction t ON t.id = l.transaction_id
     WHERE t.outlet_id IN (${marks}) AND t.is_delete_requested = 0
       AND l.log_type IN ('DP', 'Lunas', 'Pelunasan') AND l.payment_method LIKE 'Tunai%'`;
  const depParams = [...ids];
  let depSql = `SELECT outlet_id, DATE_FORMAT(deposit_date, '%Y-%m-%d') AS d, deposit_amount, proof_url, notes, uploaded_by, uploaded_at
     FROM tr_event_deposit WHERE outlet_id IN (${marks})`;
  if (start) {
    cashSql += ' AND DATE(l.created_at) >= ?';
    cashParams.push(start);
    depSql += ' AND deposit_date >= ?';
    depParams.push(start);
  }
  cashSql += ' AND DATE(l.created_at) <= ? GROUP BY t.outlet_id, d';
  cashParams.push(end);
  depSql += ' AND deposit_date <= ?';
  depParams.push(end);

  const [cashRows] = await myWaschenPool.query(cashSql, cashParams);
  const [depRows] = await myWaschenPool.query(depSql, depParams);
  const nameMap = await getEmployeeNames(depRows.map((r) => r.uploaded_by));

  const byKey = new Map();
  for (const r of cashRows) {
    if (Number(r.cash) > 0) byKey.set(`${r.outlet_id}|${r.d}`, { outlet_id: r.outlet_id, d: r.d, cash: Number(r.cash) });
  }
  const depByKey = new Map(depRows.map((r) => [`${r.outlet_id}|${r.d}`, r]));
  for (const [k, r] of depByKey) {
    if (!byKey.has(k)) byKey.set(k, { outlet_id: r.outlet_id, d: r.d, cash: 0 });
  }

  return [...byKey.entries()].map(([k, day]) => {
    const dep = depByKey.get(k);
    const uploaded = Boolean(dep);
    const refKey = uploaded ? toWibDateKey(dep.uploaded_at) || todayKey : todayKey;
    const lateDays = Math.max(0, dayDiff(refKey, day.d) - DEPOSIT_DUE_DAYS);
    return {
      kind: 'event',
      key: `event-${day.outlet_id}-${day.d}`,
      sort_at: new Date(`${day.d}T23:59:59+07:00`).toISOString(),
      id: null,
      outlet_id: day.outlet_id,
      outlet_name: nameOf[Number(day.outlet_id)] || `Event #${day.outlet_id}`,
      event_date: day.d,
      cash_amount: day.cash,
      deposit_amount: uploaded ? Number(dep.deposit_amount) : null,
      status: uploaded ? 'uploaded' : 'pending',
      is_late: lateDays > 0,
      late_days: lateDays,
      deposit_proof_url: uploaded ? dep.proof_url : null,
      deposit_notes: uploaded ? dep.notes : null,
      deposit_uploaded_at: uploaded ? dep.uploaded_at : null,
      deposit_uploaded_by: uploaded ? dep.uploaded_by : null,
      deposit_uploaded_by_name: uploaded ? formatEmployeeLabel(dep.uploaded_by, nameMap) : null
    };
  });
};

/**
 * GET /api/deposit-report?outlet_id=&start=&end=&status=
 * outlet_id kosong = semua outlet (dipakai manajemen). end dipotong sampai hari ini.
 * status: all | pending | uploaded | late
 */
export const listDepositReport = async (req, res) => {
  try {
    const todayKey = todayWibISO();
    const outletId = parseInt(req.query.outlet_id) || null;
    const start = isDateKey(req.query.start) ? req.query.start : null;
    let end = isDateKey(req.query.end) ? req.query.end : todayKey;
    if (end > todayKey) end = todayKey;
    const status = ['pending', 'uploaded', 'late'].includes(req.query.status) ? req.query.status : 'all';

    // Outlet event tanpa shift → baris per hari; outlet biasa → baris per closing Final.
    const eventOnly = outletId ? await isEventOutlet(outletId) : false;
    const shiftRows = eventOnly ? [] : await loadShiftRows({ outletId, start, end, todayKey });
    const eventRows = outletId && !eventOnly ? [] : await loadEventRows({ outletId, start, end, todayKey });

    const all = [...shiftRows, ...eventRows].sort((x, y) => (x.sort_at < y.sort_at ? 1 : -1));
    const summary = {
      total: all.length,
      uploaded: all.filter((r) => r.status === 'uploaded').length,
      pending: all.filter((r) => r.status === 'pending').length,
      late: all.filter((r) => r.is_late).length
    };

    const data = all.filter((r) => {
      if (status === 'pending') return r.status === 'pending';
      if (status === 'uploaded') return r.status === 'uploaded';
      if (status === 'late') return r.is_late;
      return true;
    });

    return res.status(200).json({
      success: true,
      data,
      summary,
      meta: { outletId, start, end, status, dueDays: DEPOSIT_DUE_DAYS }
    });
  } catch (error) {
    console.error('listDepositReport:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/deposit-report/pending-count?outlet_id=
 * Untuk badge pemberitahuan di modal Open Shift dan menu. Hanya menghitung, tidak memblokir.
 */
export const getPendingDepositCount = async (req, res) => {
  try {
    const outletId = parseInt(req.query.outlet_id) || null;
    const params = [];
    let sql = `SELECT id, closed_at FROM tr_cashier_shift
      WHERE status = 'Closed' AND close_type = 'Final' AND deposit_proof_url IS NULL`;
    if (outletId) {
      sql += ' AND outlet_id = ?';
      params.push(outletId);
    }
    const [rows] = await myWaschenPool.query(sql, params);

    const todayKey = todayWibISO();
    const lateCount = rows.filter(
      (r) => dayDiff(todayKey, toWibDateKey(r.closed_at)) - DEPOSIT_DUE_DAYS > 0
    ).length;

    return res.status(200).json({
      success: true,
      data: { pendingCount: rows.length, lateCount }
    });
  } catch (error) {
    console.error('getPendingDepositCount:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/deposit-report/:id/proof
 * multipart: proof (file), body: { notes }
 * Pengunggah diambil dari token sesi; body.uploadedBy hanya cadangan.
 */
export const uploadDepositProof = async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id);
    const notes = String(req.body?.notes || '').trim();
    const uploaderId = parseInt(req.auth?.employeeId) || parseInt(req.body?.uploadedBy) || null;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Bukti setoran wajib diupload' });
    }

    const [rows] = await myWaschenPool.query(
      'SELECT id, outlet_id, close_type, status, deposit_proof_url FROM tr_cashier_shift WHERE id = ?',
      [shiftId]
    );
    if (!rows.length) {
      await safeUnlinkAbsPath(req.file.path);
      return res.status(404).json({ success: false, message: 'Shift tidak ditemukan' });
    }
    if (rows[0].status !== 'Closed' || rows[0].close_type !== 'Final') {
      await safeUnlinkAbsPath(req.file.path);
      return res.status(400).json({ success: false, message: 'Bukti setoran hanya berlaku untuk closing Final' });
    }
    if (!uploaderId) {
      await safeUnlinkAbsPath(req.file.path);
      return res.status(400).json({ success: false, message: 'Identitas pengunggah tidak ditemukan. Silakan login ulang.' });
    }

    const proofUrl = buildUploadPublicUrl(path.posix.join(DEPOSIT_REPORT_FRONTLINER_SUBDIR, req.file.filename));

    await myWaschenPool.query(
      `UPDATE tr_cashier_shift SET
         deposit_proof_url = ?,
         deposit_notes = ?,
         deposit_uploaded_at = NOW(),
         deposit_uploaded_by = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [proofUrl, notes || null, uploaderId, shiftId]
    );

    await replaceUploadUrl(rows[0].deposit_proof_url, proofUrl);

    const [[updated]] = await myWaschenPool.query(`${SELECT_FINAL_CLOSING} AND s.id = ?`, [shiftId]);
    const nameMap = await getEmployeeNames([
      updated.cashier_employee_id,
      updated.closed_by_employee_id,
      updated.deposit_uploaded_by
    ]);

    emitDashboardRefresh('shift:updated', {
      outletId: rows[0].outlet_id,
      shiftId,
      action: 'deposit-proof'
    });

    return res.status(200).json({
      success: true,
      message: 'Bukti setoran berhasil diupload',
      data: withDepositStatus(updated, nameMap, todayWibISO())
    });
  } catch (error) {
    console.error('uploadDepositProof:', error);
    if (req.file?.path) await safeUnlinkAbsPath(req.file.path);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/deposit-report/event/:outletId/:date/proof
 * multipart: proof (file), body: { amount, notes }
 * Setoran tunai satu hari untuk outlet Event. Upload ulang pada hari yang sama menimpa.
 */
export const uploadEventDepositProof = async (req, res) => {
  const discard = async () => {
    if (req.file?.path) await safeUnlinkAbsPath(req.file.path);
  };
  try {
    const outletId = parseInt(req.params.outletId);
    const date = String(req.params.date || '');
    const amount = Number(String(req.body?.amount ?? '').replace(/[^\d.]/g, ''));
    const notes = String(req.body?.notes || '').trim();
    const uploaderId = parseInt(req.auth?.employeeId) || null;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Bukti setoran wajib diupload' });
    }
    if (!isDateKey(date) || date > todayWibISO()) {
      await discard();
      return res.status(400).json({ success: false, message: 'Tanggal setoran tidak valid' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      await discard();
      return res.status(400).json({ success: false, message: 'Nominal setoran wajib diisi' });
    }
    if (!uploaderId) {
      await discard();
      return res.status(400).json({ success: false, message: 'Identitas pengunggah tidak ditemukan. Silakan login ulang.' });
    }
    if (!(await isEventOutlet(outletId))) {
      await discard();
      return res.status(400).json({ success: false, message: 'Outlet ini bukan outlet Event' });
    }

    const proofUrl = buildUploadPublicUrl(path.posix.join(DEPOSIT_REPORT_FRONTLINER_SUBDIR, req.file.filename));
    const [oldRows] = await myWaschenPool.query(
      'SELECT proof_url FROM tr_event_deposit WHERE outlet_id = ? AND deposit_date = ?',
      [outletId, date]
    );

    await myWaschenPool.query(
      `INSERT INTO tr_event_deposit (outlet_id, deposit_date, deposit_amount, proof_url, notes, uploaded_by, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         deposit_amount = VALUES(deposit_amount),
         proof_url = VALUES(proof_url),
         notes = VALUES(notes),
         uploaded_by = VALUES(uploaded_by),
         uploaded_at = NOW()`,
      [outletId, date, amount, proofUrl, notes || null, uploaderId]
    );

    if (oldRows[0]?.proof_url) await replaceUploadUrl(oldRows[0].proof_url, proofUrl);

    emitDashboardRefresh('shift:updated', { outletId, action: 'event-deposit-proof' });

    const rows = await loadEventRows({ outletId, start: date, end: date, todayKey: todayWibISO() });
    return res.status(200).json({
      success: true,
      message: 'Bukti setoran Event berhasil diupload',
      data: rows.find((r) => r.event_date === date) || null
    });
  } catch (error) {
    console.error('uploadEventDepositProof:', error);
    await discard();
    return res.status(500).json({ success: false, message: error.message });
  }
};
