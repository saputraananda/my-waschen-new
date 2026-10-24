import { myWaschenPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import { getEmployeeNames, formatEmployeeLabel } from '../utils/employeeNames.js';
import { todayWibISO, formatWibWeekdayUpper, formatWibDateLong } from '../utils/wib.js';

const formatRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const enrichShiftRow = async (row) => {
  if (!row) return null;
  const nameMap = await getEmployeeNames([
    row.cashier_employee_id,
    row.closed_by_employee_id,
    row.last_active_employee_id,
    row.deposit_uploaded_by
  ]);
  return {
    ...row,
    opener_name: formatEmployeeLabel(row.cashier_employee_id, nameMap),
    closed_by_name: row.closed_by_employee_id
      ? formatEmployeeLabel(row.closed_by_employee_id, nameMap)
      : null,
    last_active_name: row.last_active_employee_id
      ? formatEmployeeLabel(row.last_active_employee_id, nameMap)
      : null,
    deposit_uploaded_by_name: row.deposit_uploaded_by
      ? formatEmployeeLabel(row.deposit_uploaded_by, nameMap)
      : null
  };
};

const buildReportText = async ({ outletId, shift, transactions, pettyExpenses, salesCashExpenses, declaredTunai, declaredNonTunai }) => {
  let outletName = `Outlet #${outletId}`;
  try {
    const [rows] = await myWaschenPool.query(
      'SELECT full_name, name FROM mst_outlet WHERE id = ? LIMIT 1',
      [outletId]
    );
    if (rows.length) outletName = rows[0].full_name || rows[0].name;
  } catch (_) { /* ignore */ }

  const closedAt = shift.closed_at ? new Date(shift.closed_at) : new Date();
  const hari = formatWibWeekdayUpper(closedAt);
  const tanggal = formatWibDateLong(closedAt);

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

  if (declaredTunai != null && declaredNonTunai != null) {
    tunai = declaredTunai;
    nonTunai = declaredNonTunai;
    total = tunai + nonTunai;
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
 * Klaim nota yatim (shift_id NULL) ke shift yang baru dibuka.
 *
 * Delivery Staff boleh buat nota di rumah customer tanpa open shift, jadi notanya
 * lahir tanpa shift_id. Frontliner yang open shift berikutnya mengambil alih
 * tanggung jawab revenue-nya. Uang tunainya diserahkan kurir ke frontliner secara
 * fisik (di luar sistem); checklist nota saat closing yang jadi bukti serah terima.
 *
 * Batas bawah = closed_at Final terakhir outlet ini. Nota yang dibuat setelah Final
 * (termasuk dini hari) masuk ke shift berikutnya, bukan hari yang sudah ditutup.
 */
const adoptOrphanTransactions = async (outletId, shiftId) => {
  const [lastFinal] = await myWaschenPool.query(
    `SELECT closed_at FROM tr_cashier_shift
     WHERE outlet_id = ? AND status = 'Closed' AND close_type = 'Final' AND closed_at IS NOT NULL
     ORDER BY closed_at DESC LIMIT 1`,
    [outletId]
  );

  const since = lastFinal[0]?.closed_at || null;
  const [result] = await myWaschenPool.query(
    `UPDATE tr_transaction
     SET shift_id = ?
     WHERE outlet_id = ? AND shift_id IS NULL${since ? ' AND order_date > ?' : ''}`,
    since ? [shiftId, outletId, since] : [shiftId, outletId]
  );

  return result.affectedRows || 0;
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

    // Enforce jam open dari mst_time_shift (jika aktif)
    try {
      const [shiftCfg] = await myWaschenPool.query(
        `SELECT open_time, close_time, enforce_open, name
         FROM mst_time_shift WHERE shift_number = ? AND is_active = 1 LIMIT 1`,
        [sn]
      );
      if (shiftCfg.length && Number(shiftCfg[0].enforce_open) === 1) {
        const ot = String(shiftCfg[0].open_time || '');
        const m = ot.match(/^(\d{1,2}):(\d{2})/);
        if (m) {
          const openMin = Number(m[1]) * 60 + Number(m[2]);
          const now = new Date();
          const nowMin = now.getHours() * 60 + now.getMinutes();
          if (nowMin < openMin) {
            return res.status(400).json({
              success: false,
              message: `Belum waktunya open ${shiftCfg[0].name || `Shift ${sn}`}. Jam open: ${m[1].padStart(2, '0')}:${m[2]}.`
            });
          }
        }
      }
    } catch (_) { /* tabel master opsional */ }

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

    // Adopsi nota yatim (dibuat Delivery Staff tanpa shift) ke shift yang baru dibuka.
    // Batas bawah = closed_at Final terakhir, supaya nota dini hari ikut terjaring
    // tapi tidak menyedot nota dari hari-hari sebelumnya.
    const adoptedCount = await adoptOrphanTransactions(oid, result.insertId);

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
      message: adoptedCount > 0
        ? `Shift ${sn === 1 ? 'Pagi' : 'Siang'} dibuka. ${adoptedCount} nota delivery masuk ke tanggung jawab shift ini.`
        : `Shift ${sn === 1 ? 'Pagi' : 'Siang'} berhasil dibuka`,
      adoptedTransactions: adoptedCount,
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
 * Daftar Daily Report: nota yang ada pembayaran (DP/Lunas/Pelunasan) di rentang shift,
 * apa pun tanggal nota dibuat. Nota baru outstanding tidak masuk.
 * is_paid_here = tunai/non-tunai dihitung dari nominal bayar di shift ini.
 */
async function getShiftPaidTxns(shift) {
  const [rows] = await myWaschenPool.query(
    `SELECT t.id, t.order_no, t.order_date, t.grand_total, t.payment_status,
            t.cashier_employee_id, t.shift_id,
            c.name AS customer_name, COALESCE(NULLIF(c.full_address, ''), c.address) AS customer_address,
            p.paid_here, p.methods, p.last_paid_at, p.log_cashier_id,
            CASE WHEN v.id IS NOT NULL THEN 1 ELSE 0 END AS is_verified,
            v.verified_at, v.verified_by
     FROM (
       SELECT transaction_id, SUM(amount) AS paid_here,
              GROUP_CONCAT(DISTINCT payment_method SEPARATOR ', ') AS methods,
              MAX(created_at) AS last_paid_at,
              MAX(cashier_employee_id) AS log_cashier_id
       FROM tr_payment_log
       WHERE log_type IN ('DP','Lunas','Pelunasan')
         AND created_at >= ? AND created_at <= COALESCE(?, NOW())
       GROUP BY transaction_id
     ) p
     JOIN tr_transaction t ON t.id = p.transaction_id
     LEFT JOIN mst_customer c ON t.customer_id = c.id
     LEFT JOIN tr_shift_txn_verify v ON v.transaction_id = t.id AND v.shift_id = ?
     WHERE t.outlet_id = ? AND t.is_delete_requested = 0
     ORDER BY p.last_paid_at ASC`,
    [shift.opened_at, shift.closed_at || null, shift.id, shift.outlet_id]
  );
  return rows.map((t) => ({
    ...t,
    cashier_employee_id: t.log_cashier_id || t.cashier_employee_id,
    payment_method: t.methods || '',
    paid_here: parseFloat(t.paid_here) || 0
  }));
}

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

    const txns = await getShiftPaidTxns(shift);

    const cashierIds = [...new Set(txns.map((t) => t.cashier_employee_id).filter(Boolean))];
    const nameMap = await getEmployeeNames(cashierIds);
    const roleMap = {};
    if (cashierIds.length) {
      const [roleRows] = await myWaschenPool.query(
        `SELECT employee_id, role FROM mst_role
         WHERE employee_id IN (${cashierIds.map(() => '?').join(',')})`,
        cashierIds
      );
      for (const r of roleRows) {
        const id = Number(r.employee_id);
        const role = String(r.role || '').trim();
        if (id && role && !roleMap[id]) roleMap[id] = role;
      }
    }
    const enriched = txns.map((t) => ({
      ...t,
      cashier_name: formatEmployeeLabel(t.cashier_employee_id, nameMap),
      cashier_role: roleMap[Number(t.cashier_employee_id)] || ''
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
      declaredRevenueTunai,
      declaredRevenueNonTunai,
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

    // Enforce jam close dari mst_time_shift (jika aktif)
    try {
      const [shiftCfg] = await myWaschenPool.query(
        `SELECT close_time, enforce_close, name
         FROM mst_time_shift WHERE shift_number = ? AND is_active = 1 LIMIT 1`,
        [sn]
      );
      if (shiftCfg.length && Number(shiftCfg[0].enforce_close) === 1) {
        const ct = String(shiftCfg[0].close_time || '');
        const m = ct.match(/^(\d{1,2}):(\d{2})/);
        if (m) {
          const closeMin = Number(m[1]) * 60 + Number(m[2]);
          const now = new Date();
          const nowMin = now.getHours() * 60 + now.getMinutes();
          if (nowMin < closeMin) {
            return res.status(400).json({
              success: false,
              message: `Belum waktunya close ${shiftCfg[0].name || `Shift ${sn}`}. Jam close: ${m[1].padStart(2, '0')}:${m[2]}.`
            });
          }
        }
      }
    } catch (_) { /* tabel master opsional */ }

    // Nota milik shift ini. Nota delivery sudah diklaim saat open shift
    // (lihat adoptOrphanTransactions), jadi cukup filter shift_id.
    const [txns] = await myWaschenPool.query(
      `SELECT t.* FROM tr_transaction t
       WHERE t.shift_id = ?
         AND t.is_delete_requested = 0`,
      [shiftId]
    );

    const paidTxns = await getShiftPaidTxns(shift);
    const unverified = paidTxns.filter((t) => Number(t.is_verified) !== 1);
    if (paidTxns.length > 0 && unverified.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Masih ada ${unverified.length} nota yang belum di-ceklis`,
        unverifiedCount: unverified.length
      });
    }

    const cash = parseFloat(actualCash);
    const petty = parseFloat(actualPettyCash);
    const hasSplit = declaredRevenueTunai != null && declaredRevenueTunai !== ''
      && declaredRevenueNonTunai != null && declaredRevenueNonTunai !== '';
    const revenueTunai = hasSplit ? parseFloat(declaredRevenueTunai) : null;
    const revenueNonTunai = hasSplit ? parseFloat(declaredRevenueNonTunai) : null;
    const revenue = hasSplit
      ? revenueTunai + revenueNonTunai
      : parseFloat(declaredRevenue);
    if (Number.isNaN(cash) || Number.isNaN(petty) || Number.isNaN(revenue) || (hasSplit && (Number.isNaN(revenueTunai) || Number.isNaN(revenueNonTunai)))) {
      return res.status(400).json({
        success: false,
        message: 'Cash, petty cash, revenue tunai, dan revenue non tunai wajib diisi angka'
      });
    }

    const systemRevenue = txns
      .filter((t) => t.payment_status === 'Lunas')
      .reduce((s, t) => s + (parseFloat(t.grand_total) || 0), 0);

    // Pengeluaran petty cash — hanya untuk report, TIDAK mengurangi cash modal.
    // Cash modal (kembalian) dan petty cash (belanja outlet) adalah dua laci terpisah.
    const [pettyOutRows] = await myWaschenPool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM tr_petty_cash
       WHERE outlet_id = ? AND type = 'Keluar' AND shift_id = ? AND status = 'Disetujui'
         AND COALESCE(is_petty_cash, 1) = 1`,
      [shift.outlet_id, shiftId]
    );
    const pettyOut = parseFloat(pettyOutRows[0]?.total) || 0;

    // expected_cash = modal kembalian yang diisi saat open shift, jangan ditimpa.
    // Revenue transaksi & petty cash tidak mengalir ke laci kembalian.
    const expected = parseFloat(shift.expected_cash ?? shift.initial_cash) || 0;
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
      salesCashExpenses: 0,
      declaredTunai: hasSplit ? revenueTunai : undefined,
      declaredNonTunai: hasSplit ? revenueNonTunai : undefined
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
    const date = req.query.date || todayWibISO();

    const [shifts] = await myWaschenPool.query(
      `SELECT * FROM tr_cashier_shift
       WHERE outlet_id = ? AND DATE(opened_at) = ?
       ORDER BY shift_number ASC, id ASC`,
      [outletId, date]
    );

    const result = [];
    for (const s of shifts) {
      const transactions = await getShiftPaidTxns(s);
      const enriched = await enrichShiftRow(s);
      result.push({
        ...enriched,
        transactions
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
 * body: { codePin, outletId?, employeeId?, mode? }
 *
 * mode:
 *  - 'pin' (default): identitas = pemilik PIN (atribusi kasir nota)
 *  - 'employee': cocokkan employeeId + PIN dulu, lalu fallback cari PIN
 *
 * Catatan: filter outlet hanya prioritas, BUKAN penolak — frontliner
 * boleh atribusi nota di outlet lain dengan PIN miliknya.
 */
export const verifyPin = async (req, res) => {
  try {
    const { employeeId, codePin, outletId } = req.body;
    const mode = String(req.body.mode || 'pin').toLowerCase();
    const pin = String(codePin || '').trim().replace(/\D/g, '');

    if (pin.length !== 4) {
      return res.status(400).json({ success: false, message: 'PIN harus 4 digit' });
    }

    const outletFilter = outletId != null && outletId !== '' && !Number.isNaN(Number(outletId))
      ? Number(outletId)
      : null;
    let rows = [];

    // 1) Mode employee: coba cocokkan employeeId + PIN
    if (mode === 'employee' && employeeId) {
      const [matched] = await myWaschenPool.query(
        `SELECT employee_id, employee_name, role, outlet_id, code_pin FROM mst_role
         WHERE employee_id = ?
           AND TRIM(CAST(code_pin AS CHAR)) = ?
         LIMIT 1`,
        [Number(employeeId), pin]
      );
      rows = matched;
    }

    // 2) Resolve by PIN — utamakan outlet aktif, jangan tolak jika beda outlet
    if (!rows.length) {
      const [byPin] = await myWaschenPool.query(
        `SELECT employee_id, employee_name, role, outlet_id, code_pin FROM mst_role
         WHERE TRIM(CAST(code_pin AS CHAR)) = ?
         ORDER BY
           CASE
             WHEN ? IS NOT NULL AND outlet_id = ? THEN 0
             WHEN role = 'Frontliner' THEN 1
             WHEN outlet_id IS NULL THEN 2
             ELSE 3
           END,
           employee_id ASC
         LIMIT 1`,
        [pin, outletFilter, outletFilter]
      );
      rows = byPin;
    }

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'PIN tidak ditemukan. Pastikan PIN frontliner sudah terdaftar di sistem.'
      });
    }

    const employeeIdResolved = Number(rows[0].employee_id);
    const fullName =
      (rows[0].employee_name ? String(rows[0].employee_name).trim() : '') ||
      `Karyawan #${employeeIdResolved}`;

    return res.status(200).json({
      success: true,
      message: 'PIN valid',
      data: {
        employeeId: employeeIdResolved,
        role: rows[0].role,
        outletId: rows[0].outlet_id,
        fullName
      }
    });
  } catch (error) {
    console.error('verifyPin:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
