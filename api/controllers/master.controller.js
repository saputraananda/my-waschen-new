import { myWaschenPool, mainPool } from '../db/pool.js';

const activeOrder = 'ORDER BY sort_order ASC, id ASC';

async function queryActive(table) {
  try {
    const [rows] = await myWaschenPool.query(
      `SELECT * FROM ${table} WHERE is_active = 1 ${activeOrder}`
    );
    return rows;
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await myWaschenPool.query(
        `SELECT * FROM ${table} WHERE is_active = 1 ORDER BY id ASC`
      );
      return rows;
    }
    throw error;
  }
}

/**
 * GET /api/masters
 * Semua master option aktif sekaligus
 */
export const getAllMasters = async (req, res) => {
  try {
    const [paymentMethods, customerSources, pettyCashCategories, promos, customerTiers, workStatuses, outlets] =
      await Promise.all([
        queryActive('mst_payment_method'),
        queryActive('mst_customer_source'),
        myWaschenPool.query('SELECT * FROM mst_petty_cash_category WHERE is_active = 1 ORDER BY id ASC').then(([rows]) => rows),
        queryActive('mst_promo'),
        queryActive('mst_customer_tier'),
        myWaschenPool.query('SELECT * FROM mst_work_status WHERE is_active = 1 ORDER BY percentage ASC, id ASC').then(([rows]) => rows),
        myWaschenPool.query('SELECT id, name, full_name, address FROM mst_outlet ORDER BY name ASC').then(([rows]) => rows)
      ]);

    return res.status(200).json({
      success: true,
      data: {
        paymentMethods,
        customerSources,
        pettyCashCategories,
        promos,
        customerTiers,
        workStatuses,
        outlets
      }
    });
  } catch (error) {
    console.error('Error fetching masters:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data master',
      error: error.message
    });
  }
};

/**
 * GET /api/masters/outlets
 * Daftar outlet dari mst_outlet
 */
export const getOutlets = async (req, res) => {
  try {
    const [rows] = await myWaschenPool.query(
      'SELECT id, name, full_name, address FROM mst_outlet ORDER BY name ASC'
    );
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching outlets from mst_outlet:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data outlet dari database'
    });
  }
};

/**
 * GET /api/masters/target
 * Target omset dari mst_target_waschen
 */
export const getTargetRevenue = async (req, res) => {
  try {
    const { outlet, outlet_id, tahun, bulan } = req.query;
    const now = new Date();
    const currentYear = tahun ? parseInt(tahun) : now.getFullYear();
    const currentMonth = bulan ? parseInt(bulan) : (now.getMonth() + 1);

    let targetNominal = 0;
    const targetOutletId = outlet_id || (outlet && !isNaN(outlet) ? parseInt(outlet) : null);

    if (targetOutletId) {
      const [rows] = await myWaschenPool.query(
        `SELECT nominal 
         FROM mst_target_waschen 
         WHERE outlet_id = ? 
           AND tahun = ? 
           AND bulan = ? 
         LIMIT 1`,
        [targetOutletId, currentYear, currentMonth]
      );

      if (rows && rows.length > 0) {
        targetNominal = rows[0].nominal;
      }
    } else if (outlet) {
      // Look up outlet ID by name from mst_outlet
      const [outletRows] = await myWaschenPool.query(
        `SELECT id FROM mst_outlet WHERE name LIKE ? OR full_name LIKE ? LIMIT 1`,
        [`%${outlet.trim()}%`, `%${outlet.trim()}%`]
      );
      if (outletRows.length > 0) {
        const foundId = outletRows[0].id;
        const [rows] = await myWaschenPool.query(
          `SELECT nominal 
           FROM mst_target_waschen 
           WHERE outlet_id = ? 
             AND tahun = ? 
             AND bulan = ? 
           LIMIT 1`,
          [foundId, currentYear, currentMonth]
        );
        if (rows && rows.length > 0) {
          targetNominal = rows[0].nominal;
        }
      }
    }

    if (!targetNominal || targetNominal === 0) {
      targetNominal = 50000000;
    }

    return res.status(200).json({
      success: true,
      data: {
        outlet: outlet || targetOutletId,
        tahun: currentYear,
        bulan: currentMonth,
        targetNominal
      }
    });
  } catch (error) {
    console.error('Error fetching target revenue:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data target revenue',
      error: error.message
    });
  }
};

export const getPaymentMethods = async (req, res) => {
  try {
    const data = await queryActive('mst_payment_method');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil metode pembayaran', error: error.message });
  }
};

export const getCustomerSources = async (req, res) => {
  try {
    const data = await queryActive('mst_customer_source');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching customer sources:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil sumber pelanggan', error: error.message });
  }
};

export const getPettyCashCategories = async (req, res) => {
  try {
    const [data] = await myWaschenPool.query(
      'SELECT * FROM mst_petty_cash_category WHERE is_active = 1 ORDER BY id ASC'
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching petty cash categories:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil kategori petty cash', error: error.message });
  }
};

export const getPromos = async (req, res) => {
  try {
    const data = await queryActive('mst_promo');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching promos:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data promo', error: error.message });
  }
};

export const getCustomerTiers = async (req, res) => {
  try {
    const data = await queryActive('mst_customer_tier');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching customer tiers:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil tier pelanggan', error: error.message });
  }
};

export const getWorkStatuses = async (req, res) => {
  try {
    const { filter_tabs } = req.query;
    let sql = 'SELECT * FROM mst_work_status WHERE is_active = 1';
    if (filter_tabs === '1' || filter_tabs === 'true') {
      sql += ' AND is_filter_tab = 1';
    }
    sql += ' ORDER BY percentage ASC, id ASC';
    const [data] = await myWaschenPool.query(sql);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching work statuses:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil status pengerjaan', error: error.message });
  }
};
