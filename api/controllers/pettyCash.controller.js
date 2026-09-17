import path from 'path';
import { myWaschenPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import { buildUploadPublicUrl, PETTY_CASH_EVIDENCE_SUBDIR, safeUnlinkAbsPath, safeUnlinkUploadUrl } from '../middleware/upload.js';

const APPROVED_STATUS = 'Disetujui';
const PENDING_STATUS = 'Pengajuan';
const REJECTED_STATUS = 'Ditolak';

/** 1 = pakai saldo petty cash; 0 = Central Cash (approval saja). */
function parseIsPettyCash(value, fallback = 1) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === false || value === 'false' || value === '0' || value === 0) return 0;
  return 1;
}

function usesPettyCashBalance(row) {
  return parseIsPettyCash(row?.is_petty_cash, 1) === 1;
}

/**
 * Petty cash / kas laci memakai initial_petty_cash dari shift aktif.
 */
const getOpenShiftPettyFloat = async (outletId) => {
  let sql = `
    SELECT id, initial_petty_cash, outlet_id
    FROM tr_cashier_shift
    WHERE status = 'Open'
  `;
  const params = [];

  if (outletId && outletId !== 'Semua') {
    sql += ' AND outlet_id = ?';
    params.push(outletId);
  }

  sql += ' ORDER BY id DESC LIMIT 1';

  const [shiftRows] = await myWaschenPool.query(sql, params);
  if (!shiftRows.length) {
    return { shiftId: null, initialPettyCash: 0 };
  }

  return {
    shiftId: shiftRows[0].id,
    initialPettyCash: parseFloat(shiftRows[0].initial_petty_cash || 0)
  };
};

/** Saldo efektif = modal awal + kas masuk disetujui − kas keluar disetujui */
async function getApprovedBalance(outletId, connection = myWaschenPool) {
  const oid = parseInt(outletId, 10);
  if (!oid) return 0;

  const { initialPettyCash } = await getOpenShiftPettyFloat(oid);

  const [rows] = await connection.query(
    `SELECT type, amount FROM tr_petty_cash
     WHERE outlet_id = ? AND status = ? AND COALESCE(is_petty_cash, 1) = 1
     ORDER BY id ASC`,
    [oid, APPROVED_STATUS]
  );

  if (!rows.length) return initialPettyCash;

  let balance = initialPettyCash;
  for (const r of rows) {
    const amt = parseFloat(r.amount) || 0;
    balance = r.type === 'Masuk' ? balance + amt : balance - amt;
  }
  return balance;
}

/**
 * GET /api/petty-cash
 */
export const getPettyCashLogs = async (req, res) => {
  try {
    const { outlet_id, type, status } = req.query;

    let sql = 'SELECT * FROM tr_petty_cash WHERE 1=1';
    const params = [];

    if (outlet_id && outlet_id !== 'Semua') {
      sql += ' AND outlet_id = ?';
      params.push(outlet_id);
    }

    if (type && type !== 'Semua') {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (status && status !== 'Semua') {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY id DESC LIMIT 100';

    const [rows] = await myWaschenPool.query(sql, params);

    const outletForBalance = outlet_id && outlet_id !== 'Semua' ? outlet_id : rows[0]?.outlet_id;
    const { initialPettyCash } = await getOpenShiftPettyFloat(outletForBalance);
    const currentBalance = outletForBalance
      ? await getApprovedBalance(outletForBalance)
      : initialPettyCash;

    const pendingCount = rows.filter((r) => r.status === PENDING_STATUS).length;
    const approvedRows = rows.filter((r) => r.status === APPROVED_STATUS && usesPettyCashBalance(r));

    return res.status(200).json({
      success: true,
      data: rows,
      initialFloat: initialPettyCash,
      initialPettyCash,
      currentBalance,
      pendingCount,
      meta: {
        approvedIn: approvedRows.filter((r) => r.type === 'Masuk').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
        approvedOut: approvedRows.filter((r) => r.type === 'Keluar').reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
      }
    });
  } catch (error) {
    console.error('Error fetching petty cash logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil buku kas kecil',
      error: error.message
    });
  }
};

/**
 * POST /api/petty-cash/upload-evidence
 */
export const uploadPettyCashEvidenceFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File bukti wajib diupload' });
    }
    const filename = req.file.filename || path.basename(req.file.path);
    const relativePath = `${PETTY_CASH_EVIDENCE_SUBDIR}/${filename}`;
    const publicUrl = buildUploadPublicUrl(relativePath);
    return res.status(200).json({
      success: true,
      message: 'Bukti pengajuan berhasil diupload',
      url: publicUrl,
      filename
    });
  } catch (error) {
    console.error('uploadPettyCashEvidenceFile:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal upload bukti pengajuan',
      error: error.message
    });
  }
};

/**
 * POST /api/petty-cash
 * Buat pengajuan — saldo belum berubah sampai disetujui
 */
export const addPettyCashEntry = async (req, res) => {
  try {
    const {
      outletId,
      cashierEmployeeId,
      shiftId,
      type,
      category,
      amount,
      description,
      receiptPhotoUrl,
      isPettyCash
    } = req.body;

    let evidenceUrl = receiptPhotoUrl || null;
    if (req.file) {
      const filename = req.file.filename || path.basename(req.file.path);
      evidenceUrl = buildUploadPublicUrl(`${PETTY_CASH_EVIDENCE_SUBDIR}/${filename}`);
    }

    const numAmount = parseFloat(amount);
    if (!type || !description || isNaN(numAmount) || numAmount <= 0) {
      if (req.file?.path) await safeUnlinkAbsPath(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Tipe (Masuk/Keluar), Keterangan, dan Nominal wajib diisi dengan benar'
      });
    }

    const resolvedOutletId = outletId || 2;
    const { shiftId: openShiftId, initialPettyCash } = await getOpenShiftPettyFloat(resolvedOutletId);
    const resolvedShiftId = shiftId || openShiftId || null;

    const balanceSnapshot = await getApprovedBalance(resolvedOutletId);
    const isPetty = parseIsPettyCash(isPettyCash, 1);

    const [result] = await myWaschenPool.query(
      `INSERT INTO tr_petty_cash 
       (outlet_id, shift_id, cashier_employee_id, type, category, is_petty_cash, amount, balance_before, balance_after, description, receipt_photo_url, status, transaction_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        resolvedOutletId,
        resolvedShiftId,
        cashierEmployeeId || 167,
        type,
        category || 'Biaya Operasional',
        isPetty,
        numAmount,
        balanceSnapshot,
        balanceSnapshot,
        description.trim(),
        evidenceUrl,
        PENDING_STATUS
      ]
    );

    const [newRow] = await myWaschenPool.query('SELECT * FROM tr_petty_cash WHERE id = ?', [result.insertId]);

    emitDashboardRefresh('petty-cash:updated', {
      outletId: resolvedOutletId,
      type,
      amount: numAmount,
      status: PENDING_STATUS
    });

    return res.status(201).json({
      success: true,
      message: `Pengajuan kas ${type.toLowerCase()} Rp ${numAmount.toLocaleString('id-ID')} menunggu persetujuan`,
      data: newRow[0],
      initialPettyCash,
      currentBalance: balanceSnapshot
    });
  } catch (error) {
    console.error('Error recording petty cash entry:', error);
    if (req.file?.path) await safeUnlinkAbsPath(req.file.path);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengajukan transaksi kas kecil',
      error: error.message
    });
  }
};

/**
 * PATCH /api/petty-cash/:id/review
 * Body: { action: 'approve' | 'reject', reviewerEmployeeId, rejectedReason? }
 */
export const reviewPettyCashEntry = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const { id } = req.params;
    const { action, rejectedReason, reviewerEmployeeId } = req.body;
    const reviewerId = parseInt(reviewerEmployeeId, 10)
      || parseInt(req.body.cashierEmployeeId, 10)
      || null;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action harus approve atau reject' });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT * FROM tr_petty_cash WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    }

    const entry = rows[0];
    if (entry.status !== PENDING_STATUS) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Pengajuan sudah ${entry.status}, tidak bisa diubah`
      });
    }

    if (action === 'reject') {
      await connection.query(
        `UPDATE tr_petty_cash
         SET status = ?, rejected_reason = ?, approved_by_employee_id = ?, approved_at = NOW(),
             receipt_photo_url = NULL, updated_at = NOW()
         WHERE id = ?`,
        [REJECTED_STATUS, rejectedReason || 'Ditolak', reviewerId, id]
      );
      await connection.commit();

      if (entry.receipt_photo_url) {
        await safeUnlinkUploadUrl(entry.receipt_photo_url);
      }

      emitDashboardRefresh('petty-cash:updated', { outletId: entry.outlet_id, status: REJECTED_STATUS });

      const [updated] = await myWaschenPool.query('SELECT * FROM tr_petty_cash WHERE id = ?', [id]);
      return res.status(200).json({
        success: true,
        message: 'Pengajuan ditolak',
        data: updated[0]
      });
    }

    const balanceBefore = await getApprovedBalance(entry.outlet_id, connection);
    const numAmount = parseFloat(entry.amount) || 0;
    const applyToBalance = usesPettyCashBalance(entry);
    const balanceAfter = !applyToBalance
      ? balanceBefore
      : entry.type === 'Masuk'
        ? balanceBefore + numAmount
        : balanceBefore - numAmount;

    await connection.query(
      `UPDATE tr_petty_cash
       SET status = ?,
           balance_before = ?,
           balance_after = ?,
           approved_by_employee_id = ?,
           approved_at = NOW(),
           rejected_reason = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [APPROVED_STATUS, balanceBefore, balanceAfter, reviewerId, id]
    );

    await connection.commit();

    emitDashboardRefresh('petty-cash:updated', {
      outletId: entry.outlet_id,
      type: entry.type,
      amount: numAmount,
      status: APPROVED_STATUS
    });

    const [updated] = await myWaschenPool.query('SELECT * FROM tr_petty_cash WHERE id = ?', [id]);
    return res.status(200).json({
      success: true,
      message: applyToBalance
        ? `Pengajuan disetujui — saldo ${entry.type === 'Keluar' ? 'berkurang' : 'bertambah'} Rp ${numAmount.toLocaleString('id-ID')}`
        : 'Pengajuan disetujui — Central Cash, saldo kas laci tidak berubah',
      data: updated[0],
      balanceBefore,
      balanceAfter
    });
  } catch (error) {
    await connection.rollback();
    console.error('reviewPettyCashEntry:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses pengajuan',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/petty-cash/shift/current
 */
export const getCurrentShift = async (req, res) => {
  try {
    const { outlet_id } = req.query;

    let sql = 'SELECT * FROM tr_cashier_shift WHERE status = "Open"';
    const params = [];
    if (outlet_id && outlet_id !== 'Semua') {
      sql += ' AND outlet_id = ?';
      params.push(outlet_id);
    }
    sql += ' ORDER BY id DESC LIMIT 1';

    const [shiftRows] = await myWaschenPool.query(sql, params);

    if (shiftRows.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Tidak ada shift kasir yang sedang aktif'
      });
    }

    return res.status(200).json({
      success: true,
      data: shiftRows[0]
    });
  } catch (error) {
    console.error('Error fetching current shift:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data shift aktif',
      error: error.message
    });
  }
};

// openShift dihapus dari sini — duplikat tanpa validasi.
// Gunakan POST /api/shifts/open (shift.controller.js) yang punya cek shift ganda,
// gate setoran, dan validasi saldo.
