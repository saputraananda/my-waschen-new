import { myWaschenPool, mainPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import { buildUploadPublicUrl, DEPOSIT_REPORT_FRONTLINER_SUBDIR } from '../middleware/upload.js';
import path from 'path';

const formatRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const getEmployeeNames = async (employeeIds = []) => {
  const ids = [...new Set(employeeIds.filter(Boolean).map(Number))];
  if (!ids.length) return {};
  try {
    const [rows] = await mainPool.query(
      `SELECT employee_id, full_name FROM mst_employee
       WHERE employee_id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    return Object.fromEntries(
      rows.map((r) => [r.employee_id, r.full_name || null]).filter(([, name]) => name)
    );
  } catch (err) {
    console.error('getEmployeeNames:', err.message);
    return {};
  }
};

const formatEmployeeLabel = (employeeId, nameMap) => {
  const name = nameMap[employeeId];
  if (name) return name;
  return employeeId ? `Karyawan #${employeeId}` : 'Kasir';
};

const enrichShiftRow = async (row) => {
  if (!row) return null;
  const nameMap = await getEmployeeNames([
    row.cashier_employee_id,
    row.closed_by_employee_id,
    row.last_active_employee_id
  ]);
  return {
    ...row,
    opener_name: formatEmployeeLabel(row.cashier_employee_id, nameMap),
    closed_by_name: row.closed_by_employee_id
      ? formatEmployeeLabel(row.closed_by_employee_id, nameMap)
      : null,
    last_active_name: row.last_active_employee_id
      ? formatEmployeeLabel(row.last_active_employee_id, nameMap)
      : null
  };
};

const buildReportText = async ({ outletId, shift, transactions, pettyExpenses, salesCashExpenses }) => {
  let outletName = `Outlet #${outletId}`;
  try {
    const [rows] = await myWaschenPool.query(
      'SELECT full_name, name FROM mst_outlet WHERE id = ? LIMIT 1',
      [outletId]
    );
    if (rows.length) outletName = rows[0].full_name || rows[0].name;
  } catch (_) { /* ignore */ }

  const dayNames = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  const closedAt = shift.closed_at ? new Date(shift.closed_at) : new Date();
  const hari = dayNames[closedAt.getDay()];
  const tanggal = closedAt.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const byMethod = {};
  let tunai = 0;
  let nonTunai = 0;
  let total = 0;

  for (const t of transactions) {
    if (t.payment_status !== 'Lunas') continue;
    const amt = parseFloat(t.grand_total) || 0;
    total += amt;
    const method = (t.payment_method || 'Lainnya').trim();
    const key = method.toUpperCase();
    byMethod[key] = (byMethod[key] || 0) + amt;
    if (/tunai|cash/i.test(method)) tunai += amt;
    else nonTunai += amt;
  }

  const methodLines = [
    'QR EDC BRI',
    'QRIS STATIS',
    'QRIS BCA',
    'QR EDC BCA',
    'DEBIT BCA',
    'DEBIT BRI',
    'TRANSFER BANK'
  ].map((label) => {
    const found = Object.entries(byMethod).find(([k]) => k.includes(label.replace(/\s+/g, ' ')) || label.includes(k));
    const val = found ? found[1] : (byMethod[label] || 0);
    return `${label.padEnd(14)}: ${formatRp(val)}`;
  }).join('\n');

  const pettyOut = pettyExpenses || 0;
  const salesCashOut = salesCashExpenses || 0;
  const sisaTunai = parseFloat(shift.actual_cash) || 0;
  const sisaPetty = parseFloat(shift.actual_petty_cash) || 0;

  return `REPORT PENJUALAN OUTLET : ${outletName}
HARI, TANGGAL  : ${hari}, ${tanggal}

TUNAI          : ${formatRp(tunai)}

NON TUNAI      : ${formatRp(nonTunai)}

${methodLines}

TOTAL          : ${formatRp(total)}

PETTY CASH     : ${formatRp(shift.initial_petty_cash || 0)}

PENGELUARAN            : ${formatRp(salesCashOut)}
(menggunakan sales cash)
PENGELUARAN            : ${formatRp(pettyOut)}
(menggunakan petty cash)
PENGELUARAN Gas & galon : ${formatRp(0)}
PENGELUARAN Waschen : ${formatRp(0)}

SISA AKTUAL TUNAI  : ${formatRp(sisaTunai)}
SISA PETTY CASH : ${formatRp(sisaPetty)}

"Dibuat otomatis Oleh Sistem"`;
};

/**
 * Cari closing Final terlama yang belum diupload bukti setorannya untuk outlet ini.
 * (FIFO — jika ada beberapa hari libur/terlewat, yang paling lama duluan yang wajib diselesaikan)
 */
const findPendingDeposit = async (outletId) => {
  const [rows] = await myWaschenPool.query(
    `SELECT id, outlet_id, shift_number, closed_at, declared_revenue
     FROM tr_cashier_shift
     WHERE outlet_id = ? AND status = 'Closed' AND close_type = 'Final' AND deposit_proof_url IS NULL
     ORDER BY closed_at ASC, id ASC
     LIMIT 1`,
    [outletId]
  );
  if (!rows.length) return null;
  const [[{ total }]] = await myWaschenPool.query(
    `SELECT COUNT(*) AS total FROM tr_cashier_shift
     WHERE outlet_id = ? AND status = 'Closed' AND close_type = 'Final' AND deposit_proof_url IS NULL`,
    [outletId]
  );
  return { ...rows[0], pendingCount: total };
};

/**
 * GET /api/shifts/pending-deposit?outlet_id=
 */
export const getPendingDeposit = async (req, res) => {
  try {
    const outletId = parseInt(req.query.outlet_id) || 2;
    const pending = await findPendingDeposit(outletId);
    return res.status(200).json({ success: true, data: pending });
  } catch (error) {
    console.error('getPendingDeposit:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/shifts/:id/deposit-proof
 * multipart: proof (file), body: { notes, uploadedBy }
 * Upload bukti setoran tunai untuk closing Final SEBELUMNYA (id shift kemarin).
 */
export const uploadDepositProof = async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id);
    const { notes, uploadedBy } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Bukti setoran wajib diupload' });
    }

    const [rows] = await myWaschenPool.query(
      `SELECT id, close_type, status FROM tr_cashier_shift WHERE id = ?`,
      [shiftId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Shift tidak ditemukan' });
    }
    if (rows[0].status !== 'Closed' || rows[0].close_type !== 'Final') {
      return res.status(400).json({ success: false, message: 'Bukti setoran hanya berlaku untuk closing Final' });
    }

    const relativePath = path.posix.join(DEPOSIT_REPORT_FRONTLINER_SUBDIR, req.file.filename);
    const proofUrl = buildUploadPublicUrl(relativePath);

    await myWaschenPool.query(
      `UPDATE tr_cashier_shift SET
         deposit_proof_url = ?,
         deposit_notes = ?,
         deposit_uploaded_at = NOW(),
         deposit_uploaded_by = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [proofUrl, notes || null, parseInt(uploadedBy) || null, shiftId]
    );

    const [updated] = await myWaschenPool.query(
      'SELECT * FROM tr_cashier_shift WHERE id = ?',
      [shiftId]
    );

    emitDashboardRefresh('shift:updated', {
      outletId: updated[0]?.outlet_id,
      shiftId,
      action: 'deposit-proof'
    });

    return res.status(200).json({
      success: true,
      message: 'Bukti setoran berhasil diupload',
      data: await enrichShiftRow(updated[0])
    });
  } catch (error) {
    console.error('uploadDepositProof:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/shifts/current?outlet_id=
 */
export const getCurrentShift = async (req, res) => {
  try {
    const outletId = parseInt(req.query.outlet_id) || null;
    let sql = `SELECT * FROM tr_cashier_shift WHERE status = 'Open'`;
    const params = [];
    if (outletId) {
      sql += ' AND outlet_id = ?';
      params.push(outletId);
    }
    sql += ' ORDER BY id DESC LIMIT 1';

    const [rows] = await myWaschenPool.query(sql, params);
    const data = rows[0] ? await enrichShiftRow(rows[0]) : null;
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('getCurrentShift:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/shifts/previous-closing?outlet_id=
 */
export const getPreviousClosing = async (req, res) => {
  try {
    const outletId = parseInt(req.query.outlet_id) || 2;
    const [rows] = await myWaschenPool.query(
      `SELECT id, actual_cash, actual_petty_cash, initial_cash, initial_petty_cash,
              declared_revenue, close_type, closed_at, shift_number, report_text
       FROM tr_cashier_shift
       WHERE outlet_id = ? AND status = 'Closed'
       ORDER BY closed_at DESC, id DESC
       LIMIT 1`,
      [outletId]
    );

    const prev = rows[0] || null;
    return res.status(200).json({
      success: true,
      data: prev
        ? {
            previousCash: parseFloat(prev.actual_cash ?? prev.initial_cash) || 0,
            previousPettyCash: parseFloat(prev.actual_petty_cash ?? prev.initial_petty_cash) || 0,
            closedAt: prev.closed_at,
            shiftNumber: prev.shift_number,
            closeType: prev.close_type
          }
        : {
            previousCash: 0,
            previousPettyCash: 0,
            closedAt: null,
            shiftNumber: null,
            closeType: null
          }
    });
  } catch (error) {
    console.error('getPreviousClosing:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/shifts/open
 */
export const openShift = async (req, res) => {
  try {
    const {
      outletId,
      cashierEmployeeId,
      shiftNumber,
      initialCash,
      initialPettyCash,
      previousCash,
      previousPettyCash,
      openImbalanceReason
    } = req.body;

    const oid = parseInt(outletId) || 2;
    const eid = parseInt(cashierEmployeeId);
    if (!eid) {
      return res.status(400).json({ success: false, message: 'cashierEmployeeId wajib diisi' });
    }

    const pendingDeposit = await findPendingDeposit(oid);
    if (pendingDeposit) {
      return res.status(400).json({
        success: false,
        message: 'Masih ada setoran tunai closing sebelumnya yang belum diupload buktinya. Upload dulu sebelum open shift.',
        requireDeposit: true,
        data: pendingDeposit
      });
    }

    const [openRows] = await myWaschenPool.query(
      `SELECT id FROM tr_cashier_shift WHERE outlet_id = ? AND status = 'Open' LIMIT 1`,
      [oid]
    );
    if (openRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Masih ada shift terbuka di outlet ini. Tutup dulu sebelum buka shift baru.',
        data: { existingShiftId: openRows[0].id }
      });
    }

    const cash = parseFloat(initialCash) || 0;
    const petty = parseFloat(initialPettyCash) || 0;
    const prevCash = parseFloat(previousCash) || 0;
    const prevPetty = parseFloat(previousPettyCash) || 0;
    const imbalanced = cash !== prevCash || petty !== prevPetty;

    if (imbalanced && !(openImbalanceReason || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nilai tidak balance dengan closing sebelumnya. Alasan wajib diisi.',
        requireReason: true
      });
    }

    // Infer shift number: if last close today was handover (1), next is 2; else 1
    let sn = parseInt(shiftNumber) || 0;
    if (!sn) {
      const [lastToday] = await myWaschenPool.query(
        `SELECT shift_number, close_type, status FROM tr_cashier_shift
         WHERE outlet_id = ? AND DATE(opened_at) = CURDATE()
         ORDER BY id DESC LIMIT 1`,
        [oid]
      );
      if (lastToday.length) {
        if (lastToday[0].close_type === 'Final') {
          return res.status(400).json({
            success: false,
            message: 'Hari ini sudah Closing Final. Tidak bisa buka shift baru sampai besok.'
          });
        }
        if (lastToday[0].close_type === 'Handover') sn = 2;
        else sn = 1;
      } else {
        sn = 1;
      }
    }

    const [result] = await myWaschenPool.query(
      `INSERT INTO tr_cashier_shift
       (outlet_id, cashier_employee_id, shift_number, opened_at,
        previous_cash, previous_petty_cash, initial_cash, initial_petty_cash,
        open_imbalance_reason, expected_cash, status)
       VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, 'Open')`,
      [
        oid,
        eid,
        sn,
        prevCash,
        prevPetty,
        cash,
        petty,
        imbalanced ? openImbalanceReason.trim() : null,
        cash
      ]
    );

    await myWaschenPool.query(
      `UPDATE tr_cashier_shift SET last_active_employee_id = ?, last_active_at = NOW() WHERE id = ?`,
      [eid, result.insertId]
    );

    const [created] = await myWaschenPool.query(
      'SELECT * FROM tr_cashier_shift WHERE id = ?',
      [result.insertId]
    );

    emitDashboardRefresh('shift:updated', {
      outletId: created[0]?.outlet_id,
      shiftId: created[0]?.id,
      action: 'open'
    });

    return res.status(201).json({
      success: true,
      message: `Shift ${sn === 1 ? 'Pagi' : 'Siang'} berhasil dibuka`,
      data: await enrichShiftRow(created[0])
    });
  } catch (error) {
    console.error('openShift:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/shifts/:id/resume
 * body: { employeeId }
 * Melanjutkan shift outlet yang masih Open (logout / double device / backup kasir).
 */
export const resumeShift = async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id);
    const employeeId = parseInt(req.body.employeeId);
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'employeeId wajib diisi' });
    }

    const [rows] = await myWaschenPool.query(
      `SELECT * FROM tr_cashier_shift WHERE id = ? AND status = 'Open' LIMIT 1`,
      [shiftId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Shift aktif tidak ditemukan' });
    }

    await myWaschenPool.query(
      `UPDATE tr_cashier_shift SET last_active_employee_id = ?, last_active_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [employeeId, shiftId]
    );

    const [updated] = await myWaschenPool.query(
      'SELECT * FROM tr_cashier_shift WHERE id = ?',
      [shiftId]
    );

    return res.status(200).json({
      success: true,
      message: 'Shift dilanjutkan',
      data: await enrichShiftRow(updated[0])
    });
  } catch (error) {
    console.error('resumeShift:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/shifts/:id/transactions
 */
export const getShiftTransactions = async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id);
    const [shiftRows] = await myWaschenPool.query(
      'SELECT * FROM tr_cashier_shift WHERE id = ?',
      [shiftId]
    );
    if (!shiftRows.length) {
      return res.status(404).json({ success: false, message: 'Shift tidak ditemukan' });
    }
    const shift = shiftRows[0];

    const [txns] = await myWaschenPool.query(
      `SELECT t.id, t.order_no, t.order_date, t.grand_total, t.payment_method, t.payment_status,
              t.cashier_employee_id, t.shift_id,
              c.name AS customer_name,
              CASE WHEN v.id IS NOT NULL THEN 1 ELSE 0 END AS is_verified,
              v.verified_at, v.verified_by
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON t.customer_id = c.id
       LEFT JOIN tr_shift_txn_verify v ON v.transaction_id = t.id AND v.shift_id = ?
       WHERE t.outlet_id = ?
         AND t.is_delete_requested = 0
         AND t.order_date >= ?
         AND (t.shift_id = ? OR (t.shift_id IS NULL AND t.order_date >= ?))
       ORDER BY t.order_date ASC`,
      [shiftId, shift.outlet_id, shift.opened_at, shiftId, shift.opened_at]
    );

    const cashierIds = [...new Set(txns.map((t) => t.cashier_employee_id).filter(Boolean))];
    const nameMap = await getEmployeeNames(cashierIds);
    const enriched = txns.map((t) => ({
      ...t,
      cashier_name: formatEmployeeLabel(t.cashier_employee_id, nameMap)
    }));

    return res.status(200).json({
      success: true,
      data: enriched,
      meta: {
        shiftId,
        total: enriched.length,
        verified: enriched.filter((t) => t.is_verified).length
      }
    });
  } catch (error) {
    console.error('getShiftTransactions:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/shifts/:id/verify-txn
 * body: { transactionId, verifiedBy, verified: true|false }
 */
export const verifyShiftTxn = async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id);
    const { transactionId, verifiedBy, verified = true } = req.body;

    if (!transactionId || !verifiedBy) {
      return res.status(400).json({ success: false, message: 'transactionId dan verifiedBy wajib' });
    }

    const [shiftRows] = await myWaschenPool.query(
      `SELECT id, status FROM tr_cashier_shift WHERE id = ?`,
      [shiftId]
    );
    if (!shiftRows.length || shiftRows[0].status !== 'Open') {
      return res.status(400).json({ success: false, message: 'Shift tidak aktif' });
    }

    if (verified) {
      await myWaschenPool.query(
        `INSERT INTO tr_shift_txn_verify (shift_id, transaction_id, verified_by, verified_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE verified_by = VALUES(verified_by), verified_at = NOW()`,
        [shiftId, transactionId, verifiedBy]
      );
    } else {
      await myWaschenPool.query(
        'DELETE FROM tr_shift_txn_verify WHERE shift_id = ? AND transaction_id = ?',
        [shiftId, transactionId]
      );
    }

    return res.status(200).json({ success: true, message: verified ? 'Nota disetujui' : 'Ceklis dibatalkan' });
  } catch (error) {
    console.error('verifyShiftTxn:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/shifts/:id/close
 */
export const closeShift = async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id);
    const {
      actualCash,
      actualPettyCash,
      declaredRevenue,
      closeType,
      closingNotes,
      cashierEmployeeId
    } = req.body;

    const [shiftRows] = await myWaschenPool.query(
      'SELECT * FROM tr_cashier_shift WHERE id = ?',
      [shiftId]
    );
    if (!shiftRows.length) {
      return res.status(404).json({ success: false, message: 'Shift tidak ditemukan' });
    }
    const shift = shiftRows[0];
    if (shift.status !== 'Open') {
      return res.status(400).json({ success: false, message: 'Shift sudah ditutup' });
    }

    const pendingDeposit = await findPendingDeposit(shift.outlet_id);
    if (pendingDeposit) {
      return res.status(400).json({
        success: false,
        message: 'Masih ada setoran tunai closing sebelumnya yang belum diupload buktinya. Upload dulu sebelum closing.',
        requireDeposit: true,
        data: pendingDeposit
      });
    }

    const sn = Number(shift.shift_number);
    let resolvedCloseType = closeType;
    if (!resolvedCloseType) {
      resolvedCloseType = sn === 1 ? 'Handover' : 'Final';
    }

    // Shift 1 (Pagi): boleh Handover (serah terima) ATAU Final (kerja sendirian seharian)
    // Shift 2 (Siang): hanya Final
    if (sn === 1 && !['Handover', 'Final'].includes(resolvedCloseType)) {
      return res.status(400).json({
        success: false,
        message: 'Shift Pagi: pilih closeType Handover atau Finalisasi'
      });
    }
    if (sn === 2 && resolvedCloseType !== 'Final') {
      return res.status(400).json({ success: false, message: 'Shift Siang harus close bertipe Final' });
    }

    // Load transactions for this shift window
    const [txns] = await myWaschenPool.query(
      `SELECT t.* FROM tr_transaction t
       WHERE t.outlet_id = ?
         AND t.is_delete_requested = 0
         AND t.order_date >= ?
         AND (t.shift_id = ? OR (t.shift_id IS NULL AND t.order_date >= ?))`,
      [shift.outlet_id, shift.opened_at, shiftId, shift.opened_at]
    );

    const [verified] = await myWaschenPool.query(
      'SELECT transaction_id FROM tr_shift_txn_verify WHERE shift_id = ?',
      [shiftId]
    );
    const verifiedSet = new Set(verified.map((v) => v.transaction_id));
    const unverified = txns.filter((t) => !verifiedSet.has(t.id));
    if (txns.length > 0 && unverified.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Masih ada ${unverified.length} nota yang belum di-ceklis`,
        unverifiedCount: unverified.length
      });
    }

    const cash = parseFloat(actualCash);
    const petty = parseFloat(actualPettyCash);
    const revenue = parseFloat(declaredRevenue);
    if (Number.isNaN(cash) || Number.isNaN(petty) || Number.isNaN(revenue)) {
      return res.status(400).json({
        success: false,
        message: 'actualCash, actualPettyCash, dan declaredRevenue wajib diisi angka'
      });
    }

    const systemRevenue = txns
      .filter((t) => t.payment_status === 'Lunas')
      .reduce((s, t) => s + (parseFloat(t.grand_total) || 0), 0);

    const [pettyOutRows] = await myWaschenPool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM tr_petty_cash
       WHERE outlet_id = ? AND type = 'Keluar' AND shift_id = ? AND status = 'Disetujui'`,
      [shift.outlet_id, shiftId]
    );
    const pettyOut = parseFloat(pettyOutRows[0]?.total) || 0;

    const expected = parseFloat(shift.initial_cash) + systemRevenue - pettyOut;
    const difference = cash - expected;

    const closedShiftPreview = {
      ...shift,
      closed_at: new Date(),
      actual_cash: cash,
      actual_petty_cash: petty,
      declared_revenue: revenue,
      initial_petty_cash: shift.initial_petty_cash
    };

    const reportText = await buildReportText({
      outletId: shift.outlet_id,
      shift: closedShiftPreview,
      transactions: txns,
      pettyExpenses: pettyOut,
      salesCashExpenses: 0
    });

    const closedById = parseInt(cashierEmployeeId) || null;

    await myWaschenPool.query(
      `UPDATE tr_cashier_shift SET
         closed_at = NOW(),
         closed_by_employee_id = ?,
         actual_cash = ?,
         actual_petty_cash = ?,
         declared_revenue = ?,
         system_cash_revenue = ?,
         system_cash_expense = ?,
         expected_cash = ?,
         difference = ?,
         close_type = ?,
         closing_notes = ?,
         report_text = ?,
         status = 'Closed',
         updated_at = NOW()
       WHERE id = ?`,
      [
        closedById,
        cash,
        petty,
        revenue,
        systemRevenue,
        pettyOut,
        expected,
        difference,
        resolvedCloseType,
        closingNotes || null,
        reportText,
        shiftId
      ]
    );

    const [updated] = await myWaschenPool.query(
      'SELECT * FROM tr_cashier_shift WHERE id = ?',
      [shiftId]
    );

    emitDashboardRefresh('shift:updated', {
      outletId: updated[0]?.outlet_id,
      shiftId,
      action: 'close',
      closeType: resolvedCloseType
    });

    return res.status(200).json({
      success: true,
      message: resolvedCloseType === 'Handover'
        ? 'Closing Handover berhasil. Silakan logout untuk serah terima.'
        : 'Closing Final berhasil.',
      data: await enrichShiftRow(updated[0]),
      reportText,
      forceLogout: true
    });
  } catch (error) {
    console.error('closeShift:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/shifts/daily-report?outlet_id=&date=YYYY-MM-DD
 */
export const getDailyReport = async (req, res) => {
  try {
    const outletId = parseInt(req.query.outlet_id) || 2;
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const [shifts] = await myWaschenPool.query(
      `SELECT * FROM tr_cashier_shift
       WHERE outlet_id = ? AND DATE(opened_at) = ?
       ORDER BY shift_number ASC, id ASC`,
      [outletId, date]
    );

    const result = [];
    for (const s of shifts) {
      const [verifies] = await myWaschenPool.query(
        `SELECT v.*, t.order_no, t.grand_total, t.payment_method, c.name AS customer_name
         FROM tr_shift_txn_verify v
         JOIN tr_transaction t ON t.id = v.transaction_id
         LEFT JOIN mst_customer c ON c.id = t.customer_id
         WHERE v.shift_id = ?
         ORDER BY v.verified_at ASC`,
        [s.id]
      );
      const enriched = await enrichShiftRow(s);
      result.push({
        ...enriched,
        verifiedTransactions: verifies
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
      meta: { outletId, date }
    });
  } catch (error) {
    console.error('getDailyReport:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/shifts/verify-pin
 * body: { employeeId, codePin } OR { codePin } (lookup any frontliner at outlet)
 */
export const verifyPin = async (req, res) => {
  try {
    const { employeeId, codePin, outletId } = req.body;
    if (!codePin) {
      return res.status(400).json({ success: false, message: 'codePin wajib diisi' });
    }
    if (String(codePin).trim().length !== 8) {
      return res.status(400).json({ success: false, message: 'PIN harus 8 digit angka' });
    }

    let rows;
    if (employeeId) {
      [rows] = await myWaschenPool.query(
        `SELECT employee_id, role, outlet_id, code_pin FROM mst_role
         WHERE employee_id = ? AND code_pin = ? LIMIT 1`,
        [employeeId, String(codePin).trim()]
      );
    } else {
      // Backup operator: match PIN at outlet
      [rows] = await myWaschenPool.query(
        `SELECT employee_id, role, outlet_id, code_pin FROM mst_role
         WHERE code_pin = ? AND role = 'Frontliner'
           AND (? IS NULL OR outlet_id = ? OR outlet_id IS NULL)
         LIMIT 1`,
        [String(codePin).trim(), outletId || null, outletId || null]
      );
    }

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'PIN tidak valid' });
    }

    const employeeIdResolved = rows[0].employee_id;
    const nameMap = await getEmployeeNames([employeeIdResolved]);

    return res.status(200).json({
      success: true,
      message: 'PIN valid',
      data: {
        employeeId: employeeIdResolved,
        role: rows[0].role,
        outletId: rows[0].outlet_id,
        fullName: nameMap[employeeIdResolved] || null
      }
    });
  } catch (error) {
    console.error('verifyPin:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
