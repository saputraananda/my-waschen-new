import { myWaschenPool, mainPool } from '../db/pool.js';
import { getWibYearMonth, todayWibISO } from '../utils/wib.js';
import { REVENUE_PAYMENTS_SQL, revenuePaymentParams, TUNAI_SQL } from '../utils/revenue.js';

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
    const [rows] = await myWaschenPool.query(
      `SELECT DATE(rp.paid_at) AS day,
              SUM(CASE WHEN ${TUNAI_SQL('rp.method')} THEN rp.amount ELSE 0 END) AS tunai,
              SUM(CASE WHEN ${TUNAI_SQL('rp.method')} THEN 0 ELSE rp.amount END) AS non_tunai,
              COUNT(DISTINCT rp.transaction_id) AS nota_count
       FROM (${REVENUE_PAYMENTS_SQL}) rp
       JOIN tr_transaction t ON t.id = rp.transaction_id
       WHERE t.is_delete_requested = 0${outletId ? ' AND t.outlet_id = ?' : ''}
       GROUP BY DATE(rp.paid_at)
       ORDER BY day ASC`,
      [...revenuePaymentParams(`${start} 00:00:00`, `${end} 23:59:59`), ...(outletId ? [outletId] : [])]
    );
    const [[cnt]] = await myWaschenPool.query(
      `SELECT COUNT(DISTINCT rp.transaction_id) AS n
       FROM (${REVENUE_PAYMENTS_SQL}) rp
       JOIN tr_transaction t ON t.id = rp.transaction_id
       WHERE t.is_delete_requested = 0${outletId ? ' AND t.outlet_id = ?' : ''}`,
      [...revenuePaymentParams(`${start} 00:00:00`, `${end} 23:59:59`), ...(outletId ? [outletId] : [])]
    );
    const byDay = {};
    let tunai = 0;
    let nonTunai = 0;
    for (const r of rows) {
      const key = r.day instanceof Date
        ? `${r.day.getFullYear()}-${String(r.day.getMonth() + 1).padStart(2, '0')}-${String(r.day.getDate()).padStart(2, '0')}`
        : String(r.day).slice(0, 10);
      const t = Number(r.tunai) || 0;
      const n = Number(r.non_tunai) || 0;
      byDay[key] = { tunai: t, nonTunai: n, total: t + n, notaCount: Number(r.nota_count) || 0 };
      tunai += t;
      nonTunai += n;
    }
    return res.json({
      success: true,
      data: { start, end, tunai, nonTunai, total: tunai + nonTunai, notaCount: Number(cnt?.n) || 0, byDay }
    });
  } catch (error) {
    console.error('getRevenueSummary:', error);
    return res.status(500).json({ success: false, message: 'Gagal memuat revenue' });
  }
};
