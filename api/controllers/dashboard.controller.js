import { myWaschenPool, mainPool } from '../db/pool.js';
import { getWibYearMonth, todayWibISO } from '../utils/wib.js';
import { REVENUE_PAYMENTS_SQL, REVENUE_PAYMENT_DETAIL_SQL, revenuePaymentParams, isTunaiMethod } from '../utils/revenue.js';
import { getEmployeeNames } from '../utils/employeeName.js';

/**
 * GET /api/dashboard/stats
 * Mengambil ringkasan metrik statistik operasional kasir & POS Waschen
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { outlet_id } = req.query;

    // Nota yang diajukan hapus tidak dihitung di semua statistik.
    let outletFilter = ' AND is_delete_requested = 0';
    const params = [];
    if (outlet_id && outlet_id !== 'Semua') {
      outletFilter += ' AND outlet_id = ?';
      params.push(outlet_id);
    }

    // 1. Today Revenue: uang masuk hari ini dari pembayaran nota (DP/Lunas/Pelunasan), lihat utils/revenue.js
    const today = todayWibISO();
    const [revRows] = await myWaschenPool.query(
      `SELECT COALESCE(SUM(rp.amount), 0) as todayRevenue
       FROM (${REVENUE_PAYMENTS_SQL}) rp
       JOIN tr_transaction t ON t.id = rp.transaction_id
       WHERE t.is_delete_requested = 0${outlet_id && outlet_id !== 'Semua' ? ' AND t.outlet_id = ?' : ''}`,
      [...revenuePaymentParams(`${today} 00:00:00`, `${today} 23:59:59`), ...params]
    );
    const todayRevenue = parseFloat(revRows[0]?.todayRevenue || 0);

    // 2. Active Orders
    const [activeRows] = await myWaschenPool.query(
      `SELECT COUNT(*) as activeCount 
       FROM tr_transaction 
       WHERE work_status > 0 AND work_status < 100 ${outletFilter}`,
      params
    );
    const activeOrdersCount = parseInt(activeRows[0]?.activeCount || 0);

    // 3. Ready to Pickup / Deliver
    const [readyRows] = await myWaschenPool.query(
      `SELECT COUNT(*) as readyCount 
       FROM tr_transaction 
       WHERE work_status > 82.5 AND work_status < 100 ${outletFilter}`,
      params
    );
    const readyOrdersCount = parseInt(readyRows[0]?.readyCount || 0);

    // 4. Unpaid Orders
    const [unpaidRows] = await myWaschenPool.query(
      `SELECT COUNT(*) as unpaidCount, COALESCE(SUM(grand_total), 0) as unpaidAmount 
       FROM tr_transaction 
       WHERE payment_status = 'Belum Lunas' ${outletFilter}`,
      params
    );
    const unpaidOrdersCount = parseInt(unpaidRows[0]?.unpaidCount || 0);
    const unpaidAmountSum = parseFloat(unpaidRows[0]?.unpaidAmount || 0);

    // 5. Total Kiloan Weight
    const [weightRows] = await myWaschenPool.query(
      `SELECT COALESCE(SUM(total_weight_kg), 0) as kiloWeight 
       FROM tr_transaction 
       WHERE order_category = 'Kiloan' ${outletFilter}`,
      params
    );
    const kiloWeightSum = parseFloat(weightRows[0]?.kiloWeight || 0);

    // 6. Monthly Target from mst_target_waschen (by outlet_id)
    let monthlyTarget = 50000000;
    try {
      const { year: currentYear, month: currentMonth } = getWibYearMonth();

      let targetSql = '';
      let targetParams = [];

      if (outlet_id && outlet_id !== 'Semua') {
        targetSql = `SELECT nominal FROM mst_target_waschen WHERE outlet_id = ? AND tahun = ? AND bulan = ? LIMIT 1`;
        targetParams = [outlet_id, currentYear, currentMonth];
      } else {
        targetSql = `SELECT COALESCE(SUM(nominal), 0) AS nominal FROM mst_target_waschen WHERE tahun = ? AND bulan = ?`;
        targetParams = [currentYear, currentMonth];
      }

      const [targetRows] = await myWaschenPool.query(targetSql, targetParams);
      if (targetRows.length > 0 && parseFloat(targetRows[0].nominal) > 0) {
        monthlyTarget = parseFloat(targetRows[0].nominal);
      }
    } catch (e) {
      console.warn('Fallback monthly target:', e.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        todayRevenue,
        monthlyTarget,
        activeOrdersCount,
        readyOrdersCount,
        unpaidOrdersCount,
        unpaidAmountSum,
        kiloWeightSum
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil statistik dashboard',
      error: error.message
    });
  }
};

/**
 * GET /api/dashboard/revenue?outlet_id=&start=YYYY-MM-DD&end=YYYY-MM-DD
 * Revenue berbasis pembayaran (uang masuk), per hari WIB: tunai / non tunai / total + jumlah nota dibayar.
 */
export const getRevenueSummary = async (req, res) => {
  try {
    const outletId = req.query.outlet_id && req.query.outlet_id !== 'Semua' ? Number(req.query.outlet_id) : null;
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.start || '')) ? req.query.start : todayWibISO();
    const end = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.end || '')) ? req.query.end : start;
    // Satu query baris pembayaran (puluhan–ratusan per periode), dijumlah di sini: sebelumnya dua
    // query berat yang sama (per hari + hitung nota) masing-masing memindai seluruh tabel pembayaran.
    const [rows] = await myWaschenPool.query(
      `SELECT rp.transaction_id, DATE_FORMAT(rp.paid_at, '%Y-%m-%d') AS day, rp.method, rp.amount
       FROM (${REVENUE_PAYMENTS_SQL}) rp
       JOIN tr_transaction t ON t.id = rp.transaction_id
       WHERE t.is_delete_requested = 0${outletId ? ' AND t.outlet_id = ?' : ''}`,
      [...revenuePaymentParams(`${start} 00:00:00`, `${end} 23:59:59`), ...(outletId ? [outletId] : [])]
    );
    const byDay = {};
    const dayNota = {};
    const allNota = new Set();
    let tunai = 0;
    let nonTunai = 0;
    for (const r of rows) {
      const key = String(r.day);
      const amount = Number(r.amount) || 0;
      const isTunai = isTunaiMethod(r.method);
      const d = byDay[key] || (byDay[key] = { tunai: 0, nonTunai: 0, total: 0, notaCount: 0 });
      if (isTunai) { d.tunai += amount; tunai += amount; } else { d.nonTunai += amount; nonTunai += amount; }
      d.total += amount;
      (dayNota[key] || (dayNota[key] = new Set())).add(r.transaction_id);
      allNota.add(r.transaction_id);
    }
    for (const key of Object.keys(byDay)) byDay[key].notaCount = dayNota[key].size;
    return res.json({
      success: true,
      data: { start, end, tunai, nonTunai, total: tunai + nonTunai, notaCount: allNota.size, byDay }
    });
  } catch (error) {
    console.error('getRevenueSummary:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat revenue' });
  }
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MODAL_ROW_LIMIT = 5000;

/**
 * GET /api/dashboard/payments?outlet_id=&start=&end=
 * Rincian setiap pembayaran revenue (modal "Revenue Bulan Ini" & "Hari Ini"): nota, customer, metode,
 * jenis bayar, kasir. Definisi sama dengan /revenue (REVENUE_PAYMENT_DETAIL_SQL).
 */
export const getRevenuePayments = async (req, res) => {
  try {
    const outletId = req.query.outlet_id && req.query.outlet_id !== 'Semua' ? Number(req.query.outlet_id) : null;
    const start = DATE_RE.test(String(req.query.start || '')) ? req.query.start : todayWibISO();
    const end = DATE_RE.test(String(req.query.end || '')) ? req.query.end : start;
    const [rows] = await myWaschenPool.query(
      `SELECT rp.log_id, rp.transaction_id, rp.amount, rp.method, rp.paid_at, rp.log_type,
              rp.cashier_employee_id, rp.is_legacy,
              t.order_no, t.order_date, t.grand_total, t.paid_amount, t.payment_status,
              c.name AS customer_name, c.phone AS customer_phone
       FROM (${REVENUE_PAYMENT_DETAIL_SQL}) rp
       JOIN tr_transaction t ON t.id = rp.transaction_id
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       WHERE t.is_delete_requested = 0${outletId ? ' AND t.outlet_id = ?' : ''}
       ORDER BY rp.paid_at DESC, rp.transaction_id DESC
       LIMIT ${MODAL_ROW_LIMIT + 1}`,
      [...revenuePaymentParams(`${start} 00:00:00`, `${end} 23:59:59`), ...(outletId ? [outletId] : [])]
    );
    const truncated = rows.length > MODAL_ROW_LIMIT;
    const list = truncated ? rows.slice(0, MODAL_ROW_LIMIT) : rows;
    const names = await getEmployeeNames(list.map((r) => r.cashier_employee_id).filter(Boolean));

    let tunai = 0;
    let nonTunai = 0;
    const byMethod = {};
    const notas = new Set();
    const data = list.map((r) => {
      const amount = Number(r.amount) || 0;
      const method = String(r.method || '').trim() || 'Lainnya';
      const isTunai = isTunaiMethod(method);
      if (isTunai) tunai += amount; else nonTunai += amount;
      byMethod[method] = (byMethod[method] || 0) + amount;
      notas.add(r.transaction_id);
      return {
        id: r.log_id ? `log-${r.log_id}` : `legacy-${r.transaction_id}`,
        transaction_id: r.transaction_id,
        order_no: r.order_no,
        order_date: r.order_date,
        customer_name: r.customer_name || 'Pelanggan',
        customer_phone: r.customer_phone || null,
        amount,
        method,
        is_tunai: isTunai,
        log_type: r.log_type,
        paid_at: r.paid_at,
        is_legacy: Number(r.is_legacy) === 1,
        cashier_name: names.get(Number(r.cashier_employee_id)) || null,
        grand_total: Number(r.grand_total) || 0,
        paid_amount: Number(r.paid_amount) || 0,
        payment_status: r.payment_status
      };
    });
    return res.json({
      success: true,
      data,
      meta: {
        start,
        end,
        truncated,
        summary: { tunai, nonTunai, total: tunai + nonTunai, notaCount: notas.size, paymentCount: data.length, byMethod }
      }
    });
  } catch (error) {
    console.error('getRevenuePayments:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat rincian pembayaran' });
  }
};

/**
 * GET /api/dashboard/receivables?outlet_id=&start=&end=   (start/end kosong = semua periode)
 * Nota belum lunas (modal "Piutang"): sama dengan kartu Piutang — payment_status terisi & bukan Lunas,
 * menurut tanggal nota. Nota pengajuan hapus tidak ikut.
 */
export const getReceivables = async (req, res) => {
  try {
    const outletId = req.query.outlet_id && req.query.outlet_id !== 'Semua' ? Number(req.query.outlet_id) : null;
    const start = DATE_RE.test(String(req.query.start || '')) ? req.query.start : null;
    const end = DATE_RE.test(String(req.query.end || '')) ? req.query.end : null;
    const where = ['t.is_delete_requested = 0', "COALESCE(t.payment_status, '') NOT IN ('', 'Lunas')"];
    const params = [];
    if (outletId) { where.push('t.outlet_id = ?'); params.push(outletId); }
    if (start) { where.push('t.order_date >= ?'); params.push(`${start} 00:00:00`); }
    if (end) { where.push('t.order_date <= ?'); params.push(`${end} 23:59:59`); }
    const [rows] = await myWaschenPool.query(
      `SELECT t.id, t.order_no, t.order_date, t.grand_total, t.paid_amount, t.payment_status,
              t.work_status, t.picked_up_at, t.cashier_employee_id,
              c.name AS customer_name, c.phone AS customer_phone
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       WHERE ${where.join(' AND ')}
       ORDER BY t.order_date DESC, t.id DESC
       LIMIT ${MODAL_ROW_LIMIT + 1}`,
      params
    );
    const truncated = rows.length > MODAL_ROW_LIMIT;
    const list = truncated ? rows.slice(0, MODAL_ROW_LIMIT) : rows;
    const names = await getEmployeeNames(list.map((r) => r.cashier_employee_id).filter(Boolean));
    let remaining = 0;
    const byStatus = {};
    const data = list.map((r) => {
      const total = Number(r.grand_total) || 0;
      const paid = Number(r.paid_amount) || 0;
      const sisa = Math.max(0, total - paid);
      const status = r.payment_status === 'Belum Lunas' ? 'Outstanding' : r.payment_status;
      remaining += sisa;
      byStatus[status] = (byStatus[status] || 0) + 1;
      return {
        id: r.id,
        order_no: r.order_no,
        order_date: r.order_date,
        customer_name: r.customer_name || 'Pelanggan',
        customer_phone: r.customer_phone || null,
        grand_total: total,
        paid_amount: paid,
        remaining: sisa,
        payment_status: status,
        work_status: Number(r.work_status) || 0,
        picked_up: Boolean(r.picked_up_at),
        cashier_name: names.get(Number(r.cashier_employee_id)) || null
      };
    });
    return res.json({ success: true, data, meta: { start, end, truncated, summary: { count: data.length, remaining, byStatus } } });
  } catch (error) {
    console.error('getReceivables:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat piutang' });
  }
};
