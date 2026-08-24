import { myWaschenPool, mainPool } from '../db/pool.js';

/**
 * GET /api/dashboard/stats
 * Mengambil ringkasan metrik statistik operasional kasir & POS Waschen
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { outlet_id } = req.query;

    let outletFilter = '';
    const params = [];
    if (outlet_id && outlet_id !== 'Semua') {
      outletFilter = ' AND outlet_id = ?';
      params.push(outlet_id);
    }

    // 1. Today Revenue (Paid orders)
    const [revRows] = await myWaschenPool.query(
      `SELECT COALESCE(SUM(grand_total), 0) as todayRevenue 
       FROM tr_transaction 
       WHERE payment_status = 'Lunas' ${outletFilter}`,
      params
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
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

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
