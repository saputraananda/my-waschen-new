import jwt from 'jsonwebtoken';
import { getSessionSecret } from '../utils/sessionSecret.js';
import { insertPosLoginLog } from '../utils/posLoginLog.js';
import { myWaschenPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import { getOutletFlags } from '../utils/dropPointOutlet.js';
import { getEmployeeNames, formatEmployeeLabel } from '../utils/employeeNames.js';
import { getShiftPaymentFrom, getShiftRevenue } from '../utils/revenue.js';
import { findEmployeeIdByPin, getManagementEmployee } from '../utils/employeePin.js';
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

export const buildReportText = async ({ outletId, shift, revenue, pettyExpenses, salesCashExpenses, declaredTunai, declaredNonTunai }) => {
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

  // Revenue = uang yang masuk di shift ini (log pembayaran DP/Lunas/Pelunasan), bukan nota yang dibuat.
  const split = revenue || { tunai: 0, nonTunai: 0, total: 0, byMethod: {} };
  const byMethod = {};
  for (const [method, amt] of Object.entries(split.byMethod || {})) {
    const key = String(method || 'Lainnya').trim().toUpperCase();
    byMethod[key] = (byMethod[key] || 0) + (Number(amt) || 0);
  }
  let tunai = split.tunai;
  let nonTunai = split.nonTunai;
  let total = split.total;

  if (declaredTunai != null && declaredNonTunai != null) {
    tunai = declaredTunai;
    nonTunai = declaredNonTunai;
    total = tunai + nonTunai;
  }

  const METHOD_LABELS = [
    'QR EDC BRI',
    'QRIS STATIS',
    'QRIS BCA',
    'QR EDC BCA',
    'DEBIT BCA',
    'DEBIT BRI',
    'TRANSFER BANK'
  ];
  // Satu metode bayar hanya masuk ke SATU baris (label pertama yang cocok). Sebelumnya tiap baris
  // mencari sendiri, jadi metode seperti "QRIS" ikut tercatat dobel di QRIS STATIS dan QRIS BCA.
  const labelTotals = Object.fromEntries(METHOD_LABELS.map((l) => [l, 0]));
  for (const [key, amount] of Object.entries(byMethod)) {
    const label = METHOD_LABELS.find((l) => key === l || key.includes(l) || l.includes(key));
    if (label) labelTotals[label] += amount;
  }
  const methodLines = METHOD_LABELS
    .map((label) => `${label.padEnd(14)}: ${formatRp(labelTotals[label])}`)
    .join('\n');

  const pettyOut = pettyExpenses || 0;
  const salesCashOut = salesCashExpenses || 0;
  // Sisa aktual tunai = total pembayaran Tunai pada closing ini (sama dengan baris TUNAI).
  // Cash Modal (actual_cash) hanyalah uang kembalian di outlet, tidak ikut dilaporkan di sini.
  const sisaTunai = tunai;
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
 * Selain Frontliner (Delivery, Manajemen, Daily Worker, staf produksi) boleh buat nota tanpa open shift, jadi notanya
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

  // Nota hasil migrasi Smartlink (source = 'SMARTLINK', backdate) TIDAK PERNAH diklaim: nota itu
  // bukan tanggung jawab petugas yang open shift. Tanpa pengecualian ini, outlet yang belum punya
  // closing Final menyedot seluruh nota lama ke shift baru sehingga revenue sistem & report membengkak.
  // Kalau nota Smartlink dilunasi di POS baru, pembayarannya tetap masuk Daily Report lewat
  // tr_payment_log (getShiftPaidTxns), tanpa perlu shift_id.
  const since = lastFinal[0]?.closed_at || null;
  const [result] = await myWaschenPool.query(
    `UPDATE tr_transaction
     SET shift_id = ?
     WHERE outlet_id = ? AND shift_id IS NULL
       AND (source IS NULL OR source <> 'SMARTLINK')${since ? ' AND order_date > ?' : ''}`,
    since ? [shiftId, outletId, since] : [shiftId, outletId]
  );

  return result.affectedRows || 0;
};

export const AUTO_CLOSE_NOTE =
  'Ditutup otomatis oleh sistem: shift belum di-close sampai ganti hari (00:00 WIB). '
  + 'Kas & revenue memakai angka sistem, belum dihitung fisik.';

/**
 * Ganti hari = ganti tanggung jawab shift. Shift yang masih Open dari tanggal sebelumnya
 * ditutup otomatis sebagai Final pada jam 23:59:59 tanggal dibukanya (waktu DB = WIB).
 * - Pembayaran setelah 00:00 otomatis masuk shift berikutnya (rentang pembayaran shift
 *   dimulai dari closed_at shift sebelumnya + 1 detik).
 * - Nota yang dibuat setelah 00:00 tapi masih menempel ke shift lama dilepas (shift_id NULL),
 *   lalu diklaim shift berikutnya yang dibuka (adoptOrphanTransactions).
 * - Angka kas memakai angka sistem (selisih 0); revenue = pembayaran sistem di rentang shift.
 * Dipanggil berkala dari index.js dan sebagai pengaman di endpoint shift.
 */
export async function autoCloseStaleShifts(outletId = null) {
  const params = [];
  let sql = `SELECT *, TIMESTAMP(DATE(opened_at), '23:59:59') AS auto_close_at
             FROM tr_cashier_shift
             WHERE status = 'Open' AND opened_at < CURDATE()`;
  if (outletId) {
    sql += ' AND outlet_id = ?';
    params.push(outletId);
  }
  const [rows] = await myWaschenPool.query(sql, params);
  const closedIds = [];

  for (const shift of rows) {
    try {
      const closedAt = shift.auto_close_at;
      const closedShift = { ...shift, closed_at: closedAt };
      const rev = await getShiftRevenue(closedShift);

      const [pettyOutRows] = await myWaschenPool.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM tr_petty_cash
         WHERE outlet_id = ? AND type = 'Keluar' AND shift_id = ? AND status IN ('Disetujui', 'Pengajuan')
           AND COALESCE(is_petty_cash, 1) = 1`,
        [shift.outlet_id, shift.id]
      );
      const pettyOut = parseFloat(pettyOutRows[0]?.total) || 0;
      const expected = parseFloat(shift.expected_cash ?? shift.initial_cash) || 0;
      const petty = Math.max(0, (parseFloat(shift.initial_petty_cash) || 0) - pettyOut);

      const reportText = await buildReportText({
        outletId: shift.outlet_id,
        shift: { ...closedShift, actual_cash: expected, actual_petty_cash: petty },
        revenue: rev,
        pettyExpenses: pettyOut,
        salesCashExpenses: 0
      });

      const [upd] = await myWaschenPool.query(
        `UPDATE tr_cashier_shift SET
           closed_at = ?,
           closed_by_employee_id = NULL,
           actual_cash = ?,
           actual_petty_cash = ?,
           declared_revenue = ?,
           system_cash_revenue = ?,
           system_cash_expense = ?,
           expected_cash = ?,
           difference = 0,
           close_type = 'Final',
           closing_notes = ?,
           report_text = ?,
           status = 'Closed',
           updated_at = NOW()
         WHERE id = ? AND status = 'Open'`,
        [closedAt, expected, petty, rev.total, rev.total, pettyOut, expected,
          AUTO_CLOSE_NOTE, reportText, shift.id]
      );
      if (!upd.affectedRows) continue; // sudah ditutup proses lain

      // Nota setelah 00:00 = tanggung jawab shift berikutnya
      await myWaschenPool.query(
        'UPDATE tr_transaction SET shift_id = NULL WHERE shift_id = ? AND order_date > ?',
        [shift.id, closedAt]
      );

      closedIds.push(shift.id);
      console.log(`[shift] auto-close shift #${shift.id} outlet ${shift.outlet_id} (ganti hari)`);
      emitDashboardRefresh('shift:updated', {
        outletId: shift.outlet_id,
        shiftId: shift.id,
        action: 'auto-close',
        closeType: 'Final'
      });
    } catch (err) {
      console.error(`autoCloseStaleShifts #${shift.id}:`, err.message);
    }
  }
  return closedIds;
}

/** Pengaman: jangan biarkan error auto-close menggagalkan endpoint. */
const ensureNoStaleShift = async (outletId) => {
  try {
    return await autoCloseStaleShifts(outletId);
  } catch (err) {
    console.error('ensureNoStaleShift:', err.message);
    return [];
  }
};

/**
 * GET /api/shifts/current?outlet_id=
 */
export const getCurrentShift = async (req, res) => {
  try {
    const outletId = parseInt(req.query.outlet_id) || null;
    await ensureNoStaleShift(outletId);
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

    // Outlet nonaktif / outlet tanpa shift (requires_shift = 0, diatur admin di SuperApp) tidak bisa buka shift.
    const outletFlags = await getOutletFlags(oid);
    if (!outletFlags.exists) {
      return res.status(404).json({ success: false, message: 'Outlet tidak ditemukan.' });
    }
    if (outletFlags.is_active !== 1) {
      return res.status(409).json({ success: false, message: 'Outlet ini sedang tidak aktif, tidak bisa membuka shift.' });
    }
    if (outletFlags.requires_shift !== 1) {
      return res.status(409).json({
        success: false,
        message: 'Outlet ini tidak memakai shift. Transaksi bisa langsung dibuat tanpa membuka shift.'
      });
    }

    await ensureNoStaleShift(oid);
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

    // Adopsi nota yatim (dibuat non-Frontliner tanpa shift) ke shift yang baru dibuka.
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
        ? `Shift ${sn === 1 ? 'Pagi' : 'Siang'} dibuka. ${adoptedCount} nota tanpa shift masuk ke tanggung jawab shift ini.`
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

    // Akun lain yang masuk ke shift yang sudah dibuka FL → dicatat (siapa, kapan, perangkat)
    const [roleRows] = await myWaschenPool.query(
      'SELECT role, employee_name FROM mst_role WHERE employee_id = ? LIMIT 1',
      [employeeId]
    );
    const names = await getEmployeeNames([employeeId]);
    await insertPosLoginLog(req, {
      event: 'Masuk Shift',
      employeeId,
      employeeName: roleRows[0]?.employee_name || names[employeeId] || null,
      role: roleRows[0]?.role || null,
      outletId: rows[0].outlet_id,
      shiftId
    });

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
 * Daftar Daily Report: nota yang ada pembayaran (DP/Lunas/Pelunasan) di rentang shift
 * (sejak closing shift sebelumnya sampai closing shift ini),
 * apa pun tanggal nota dibuat. Nota baru outstanding tidak masuk.
 * is_paid_here = tunai/non-tunai dihitung dari nominal bayar di shift ini.
 */
async function getShiftPaidTxns(shift) {
  // Sejak closing shift sebelumnya: pembayaran saat tidak ada shift terbuka ikut ke shift ini
  const paidFrom = await getShiftPaymentFrom(shift);
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
    [paidFrom, shift.closed_at || null, shift.id, shift.outlet_id]
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

    // Rincian revenue per pembayaran (satu nota bisa DP tunai + pelunasan non tunai)
    const rev = await getShiftRevenue(shift);
    return res.status(200).json({
      success: true,
      data: enriched,
      meta: {
        shiftId,
        total: enriched.length,
        verified: enriched.filter((t) => t.is_verified).length,
        revenue: { tunai: rev.tunai, nonTunai: rev.nonTunai, total: rev.total }
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
    const autoClosed = await ensureNoStaleShift(shift.outlet_id);
    if (autoClosed.includes(shift.id)) {
      return res.status(409).json({
        success: false,
        autoClosed: true,
        message: 'Shift ini sudah ganti hari, jadi ditutup otomatis oleh sistem (Final, 23:59). Silakan open shift baru untuk hari ini.'
      });
    }

    // Close oleh orang selain pembuka shift (backup): wajib PIN, dan PIN harus milik akun yang login.
    const closerId = parseInt(cashierEmployeeId, 10) || null;
    const sessionEmployeeId = Number(readSessionEmployeeId(req)) || null;
    if (closerId && Number(shift.cashier_employee_id) !== closerId) {
      const pin = String(req.body.codePin || '').replace(/\D/g, '');
      if (pin.length !== 4) {
        return res.status(400).json({ success: false, message: 'PIN wajib diisi untuk close shift oleh kasir pengganti' });
      }
      const pinOwner = await findEmployeeIdByPin(pin);
      if (!pinOwner) {
        return res.status(401).json({ success: false, message: 'PIN tidak ditemukan' });
      }
      const loggedIn = sessionEmployeeId || closerId;
      if (Number(pinOwner) !== Number(loggedIn) || Number(pinOwner) !== closerId) {
        return res.status(403).json({ success: false, message: 'PIN tidak sesuai dengan akun yang sedang login' });
      }
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

    // Revenue sistem = pembayaran yang masuk selama shift (DP/Lunas/Pelunasan), dipisah tunai / non tunai
    const shiftRevenue = await getShiftRevenue({ ...shift, closed_at: null });
    const systemRevenue = shiftRevenue.total;

    // Pengeluaran petty cash — hanya untuk report, TIDAK mengurangi cash modal.
    // Termasuk yang masih Pengajuan (uang sudah keluar dari laci); Ditolak tidak dihitung.
    // Cash modal (kembalian) dan petty cash (belanja outlet) adalah dua laci terpisah.
    const [pettyOutRows] = await myWaschenPool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM tr_petty_cash
       WHERE outlet_id = ? AND type = 'Keluar' AND shift_id = ? AND status IN ('Disetujui', 'Pengajuan')
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
      revenue: shiftRevenue,
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
      const rawTxns = await getShiftPaidTxns(s);
      const cashierIds = [...new Set(rawTxns.map((t) => t.cashier_employee_id).filter(Boolean))];
      const nameMap = await getEmployeeNames(cashierIds);
      const transactions = rawTxns.map((t) => ({
        ...t,
        cashier_name: formatEmployeeLabel(t.cashier_employee_id, nameMap)
      }));
      const enriched = await enrichShiftRow(s);
      // Revenue = uang masuk di shift (dihitung ulang, jadi selalu konsisten dengan daftar nota dibayar)
      const rev = await getShiftRevenue(s);
      result.push({
        ...enriched,
        revenue_tunai: rev.tunai,
        revenue_non_tunai: rev.nonTunai,
        revenue_total: rev.total,
        revenue_by_method: rev.byMethod,
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
 * body: { codePin }
 *
 * PIN dibaca dari waschen.mst_employee_pin (4 digit, unik). Pemilik PIN = kasir nota,
 * asalkan terdaftar di mst_role. Beda outlet tidak ditolak.
 */
export const verifyPin = async (req, res) => {
  try {
    // employeeId/outletId/mode dari klien lama diabaikan: PIN unik, pemiliknya = kasir nota.
    const { codePin } = req.body;
    const pin = String(codePin || '').trim().replace(/\D/g, '');

    if (pin.length !== 4) {
      return res.status(400).json({ success: false, message: 'PIN harus 4 digit' });
    }

    // PIN unik per karyawan (mst_employee_pin, DB utama)
    const ownerId = await findEmployeeIdByPin(pin);
    let rows = [];
    if (ownerId) {
      // Kasir nota: staf Waschen (punya mst_role) atau Manajemen (company_id = 1)
      const [roleRows] = await myWaschenPool.query(
        'SELECT employee_id, employee_name, role, outlet_id FROM mst_role WHERE employee_id = ? LIMIT 1',
        [ownerId]
      );
      rows = roleRows;
      if (!rows.length) {
        const mgmt = await getManagementEmployee(ownerId);
        if (mgmt) {
          rows = [{ employee_id: mgmt.employee_id, employee_name: mgmt.full_name, role: 'Management', outlet_id: null }];
        }
      }
      if (rows.length && !String(rows[0].employee_name || '').trim()) {
        const names = await getEmployeeNames([ownerId]);
        rows[0].employee_name = names.get(ownerId) || null;
      }
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

/** employee_id dari token sesi POS (opsional; route shift tidak memakai requirePosAuth). */
function readSessionEmployeeId(req) {
  const raw = String(req.headers?.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  if (!token) return null;
  try {
    return jwt.verify(token, getSessionSecret())?.employeeId || null;
  } catch {
    return null;
  }
}

/**
 * GET /api/shifts/:id/logins — siapa saja yang login / masuk ke shift ini:
 * baris "Masuk Shift" untuk shift ini + "Login" di outlet itu selama shift berjalan.
 */
export const getShiftLogins = async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id, 10);
    const [[shift]] = await myWaschenPool.query('SELECT id, outlet_id, opened_at, closed_at FROM tr_cashier_shift WHERE id = ?', [shiftId]);
    if (!shift) return res.status(404).json({ success: false, message: 'Shift tidak ditemukan' });
    const [rows] = await myWaschenPool.query(
      `SELECT id, event, employee_id, employee_name, role, outlet_id, shift_id, ip_address, user_agent, created_at
       FROM tr_pos_login_log
       WHERE shift_id = ?
          OR (event = 'Login' AND outlet_id = ? AND created_at >= ? AND created_at <= COALESCE(?, NOW()))
       ORDER BY created_at DESC, id DESC
       LIMIT 300`,
      [shift.id, shift.outlet_id, shift.opened_at, shift.closed_at]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return res.status(200).json({ success: true, data: [] });
    console.error('getShiftLogins:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
