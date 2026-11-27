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
import { getShiftRevenue } from '../utils/revenue.js';

/**
 * Yang disetor = uang TUNAI saja (non tunai sudah masuk rekening).
 * Sumber utama: baris "TUNAI : Rp ..." di report closing (angka yang dideklarasikan kasir);
 * cadangan: pembayaran tunai sistem di rentang shift.
 */
const parseReportTunai = (text) => {
  const m = String(text || '').match(/^TUNAI\s*:\s*Rp\s*([\d.,]+)/m);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const attachCashRevenue = async (row) => {
  // Utama: tunai yang tercatat sistem di rentang shift — ikut ter-update bila ada pembayaran
  // yang masuk belakangan (mis. sinkron Smartlink setelah closing). Angka laporan kasir disimpan
  // sebagai pembanding.
  const reported = parseReportTunai(row.report_text);
  let cash = null;
  try {
    cash = (await getShiftRevenue(row)).tunai;
  } catch (_) {
    cash = reported;
  }
  return { ...row, cash_revenue: cash, cash_reported: reported };
};

/**
 * Setoran tunai = bukti setor uang hasil closing Final (tr_cashier_shift.deposit_*), semua outlet.
 * Tidak memblokir open/close shift — hanya dilaporkan di menu Setoran Tunai.
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
  // Tidak ada pembayaran tunai di shift ini → tidak ada uang yang perlu disetor
  const noCash = !uploaded && row.cash_revenue != null && Math.round(Number(row.cash_revenue)) <= 0;
  const refKey = uploaded ? toWibDateKey(row.deposit_uploaded_at) || todayKey : todayKey;
  const lateDays = noCash ? 0 : Math.max(0, dayDiff(refKey, closedKey) - DEPOSIT_DUE_DAYS);

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
      : (String(row.closing_notes || '').startsWith('Ditutup otomatis') ? 'Sistem (otomatis ganti hari)' : null),
    auto_closed: !row.closed_by_employee_id && String(row.closing_notes || '').startsWith('Ditutup otomatis'),
    opened_at: row.opened_at,
    closed_at: row.closed_at,
    declared_revenue: row.declared_revenue,
    // Nominal yang wajib disetor (Tunai saja)
    cash_revenue: row.cash_revenue ?? null,
    // Tunai menurut laporan closing kasir (null bila tidak ada report)
    cash_reported: row.cash_reported ?? null,
    status: uploaded ? 'uploaded' : (noCash ? 'none' : 'pending'),
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
         s.opened_at, s.closed_at, s.declared_revenue, s.closing_notes, s.report_text,
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
  const withCash = await Promise.all(rows.map(attachCashRevenue));
  return withCash.map((r) => withDepositStatus(r, nameMap, todayKey));
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

    // Satu baris per closing Final shift, untuk semua outlet.
    const all = await loadShiftRows({ outletId, start, end, todayKey });
    const summary = {
      total: all.length,
      uploaded: all.filter((r) => r.status === 'uploaded').length,
      pending: all.filter((r) => r.status === 'pending').length,
      none: all.filter((r) => r.status === 'none').length,
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
    let sql = `SELECT id, outlet_id, opened_at, closed_at, report_text FROM tr_cashier_shift
      WHERE status = 'Closed' AND close_type = 'Final' AND deposit_proof_url IS NULL`;
    if (outletId) {
      sql += ' AND outlet_id = ?';
      params.push(outletId);
    }
    const [rawRows] = await myWaschenPool.query(sql, params);
    // Closing tanpa pembayaran tunai = Tidak Perlu Setor, tidak dihitung
    const rows = (await Promise.all(rawRows.map(attachCashRevenue)))
      .filter((r) => !(r.cash_revenue != null && Math.round(Number(r.cash_revenue)) <= 0));

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
      data: withDepositStatus(await attachCashRevenue(updated), nameMap, todayWibISO())
    });
  } catch (error) {
    console.error('uploadDepositProof:', error);
    if (req.file?.path) await safeUnlinkAbsPath(req.file.path);
    return res.status(500).json({ success: false, message: error.message });
  }
};
