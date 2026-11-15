import { myWaschenPool } from '../db/pool.js';
import { EFFECTIVE_SERVICE_COLUMNS, EFFECTIVE_UNIT_SQL, EFFECTIVE_CATEGORY_ID_SQL } from '../utils/serviceOutlet.js';

/**
 * GET /api/services?outlet_id=
 * Dengan outlet_id: layanan yang tersedia di outlet itu (mst_service_outlet), nilai efektif
 * = override outlet atau master. Tanpa outlet_id: master layanan aktif (mis. untuk BOM inventory).
 */
export const getServices = async (req, res) => {
  try {
    const { category, search } = req.query;
    const outletId = parseInt(req.query.outlet_id, 10) || null;

    // Tanpa outlet: so = baris kosong, sehingga nilai efektif = master.
    let sql = `
      SELECT ${EFFECTIVE_SERVICE_COLUMNS},
             c.name as category_name,
             c.code as category_code,
             COALESCE(c.is_production, 1) as category_is_production,
             ${EFFECTIVE_UNIT_SQL} as unit,
             u.name as unit_name
      FROM mst_service s
      ${outletId
        ? 'JOIN mst_service_outlet so ON so.service_id = s.id AND so.outlet_id = ? AND so.is_active = 1'
        : 'LEFT JOIN mst_service_outlet so ON 1 = 0'}
      LEFT JOIN mst_service_category c ON c.id = ${EFFECTIVE_CATEGORY_ID_SQL}
      LEFT JOIN mst_unit u ON u.id = COALESCE(so.unit_id, s.unit_id)
      WHERE s.is_active = 1
    `;
    const params = outletId ? [outletId] : [];

    if (category && category !== 'Semua') {
      sql += ' AND (c.code = ? OR c.name LIKE ?)';
      params.push(category, `%${category}%`);
    }

    if (search && search.trim()) {
      sql += ' AND (COALESCE(so.name, s.name) LIKE ? OR s.code LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ' ORDER BY s.is_featured DESC, s.id ASC';

    const [rows] = await myWaschenPool.query(sql, params);
    // Kategori yang punya layanan di outlet ini (outlet tanpa layanan = tanpa kategori).
    const [categories] = outletId
      ? await myWaschenPool.query(
        `SELECT * FROM mst_service_category
         WHERE is_active = 1 AND id IN (
           SELECT DISTINCT ${EFFECTIVE_CATEGORY_ID_SQL}
           FROM mst_service_outlet so JOIN mst_service s ON s.id = so.service_id
           WHERE so.outlet_id = ? AND so.is_active = 1 AND s.is_active = 1)
         ORDER BY id ASC`,
        [outletId]
      )
      : await myWaschenPool.query('SELECT * FROM mst_service_category WHERE is_active = 1 ORDER BY id ASC');

    return res.status(200).json({
      success: true,
      data: rows,
      categories: categories
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar layanan',
      error: error.message
    });
  }
};

/**
 * GET /api/services/speeds
 * Mengambil master kecepatan pengerjaan & persentase surcharge
 */
export const getServiceSpeeds = async (req, res) => {
  try {
    const [rows] = await myWaschenPool.query('SELECT * FROM mst_service_speed WHERE is_active = 1 ORDER BY id ASC');
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching service speeds:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data kecepatan pengerjaan',
      error: error.message
    });
  }
};

/**
 * GET /api/services/parfumes
 * Mengambil daftar aroma parfum aktif
 */
export const getParfumes = async (req, res) => {
  try {
    const [rows] = await myWaschenPool.query('SELECT * FROM mst_parfume WHERE is_active = 1 ORDER BY id ASC');
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching parfumes:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar parfum',
      error: error.message
    });
  }
};

/**
 * GET /api/services/units
 * Mengambil daftar master satuan (mst_unit)
 */
export const getUnits = async (req, res) => {
  try {
    const [rows] = await myWaschenPool.query('SELECT * FROM mst_unit WHERE is_active = 1 ORDER BY id ASC');
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching units:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar satuan',
      error: error.message
    });
  }
};

/**
 * POST /api/services
 * Tambah item layanan baru
 */
export const createService = async (req, res) => {
  try {
    const { categoryId, unitId, code, name, price, regularDurationDays, minOrderQty, description, isFeatured } = req.body;

    if (!categoryId || !name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Kategori, Nama Layanan, dan Harga wajib diisi'
      });
    }

    const [result] = await myWaschenPool.query(
      `INSERT INTO mst_service 
       (category_id, unit_id, code, name, price, regular_duration_days, min_order_qty, description, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryId,
        unitId || 1,
        code || `SVC-${Date.now().toString().slice(-4)}`,
        name.trim(),
        parseFloat(price) || 0,
        parseFloat(regularDurationDays) || 2.0,
        parseFloat(minOrderQty) || 1,
        description || null,
        isFeatured ? 1 : 0
      ]
    );
    // Layanan baru langsung tersedia di semua outlet (termasuk outlet Drop Point).
    await myWaschenPool.query(
      `INSERT IGNORE INTO mst_service_outlet (service_id, outlet_id, is_active)
       SELECT ?, id, 1 FROM mst_outlet`,
      [result.insertId]
    );

    const [newService] = await myWaschenPool.query(
      `SELECT s.*, COALESCE(s.unit, u.symbol, u.code, 'Kg') as unit, u.name as unit_name
       FROM mst_service s
       LEFT JOIN mst_unit u ON s.unit_id = u.id
       WHERE s.id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Layanan baru berhasil ditambahkan',
      data: newService[0]
    });
  } catch (error) {
    console.error('Error creating service:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan layanan',
      error: error.message
    });
  }
};
