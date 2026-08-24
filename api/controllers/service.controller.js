import { myWaschenPool } from '../db/pool.js';

/**
 * GET /api/services
 * Mengambil daftar layanan/jasa laundry beserta kategorinya
 */
export const getServices = async (req, res) => {
  try {
    const { category, search } = req.query;

    let sql = `
      SELECT s.*, 
             c.name as category_name, 
             c.code as category_code,
             COALESCE(s.unit, u.symbol, u.code, 'Kg') as unit,
             u.name as unit_name
      FROM mst_service s
      LEFT JOIN mst_service_category c ON s.category_id = c.id
      LEFT JOIN mst_unit u ON s.unit_id = u.id
      WHERE s.is_active = 1
    `;
    const params = [];

    if (category && category !== 'Semua') {
      sql += ' AND (c.code = ? OR c.name LIKE ?)';
      params.push(category, `%${category}%`);
    }

    if (search && search.trim()) {
      sql += ' AND (s.name LIKE ? OR s.code LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ' ORDER BY s.is_featured DESC, s.id ASC';

    const [rows] = await myWaschenPool.query(sql, params);
    const [categories] = await myWaschenPool.query('SELECT * FROM mst_service_category WHERE is_active = 1 ORDER BY id ASC');

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
