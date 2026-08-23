import { myWaschenPool } from '../db/pool.js';

/**
 * GET /api/memberships/packages
 * Mengambil daftar paket membership & kuota aktif
 */
export const getMembershipPackages = async (req, res) => {
  try {
    const [rows] = await myWaschenPool.query(
      'SELECT * FROM mst_membership_package WHERE is_active = 1 ORDER BY price ASC'
    );
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching membership packages:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar paket membership',
      error: error.message
    });
  }
};

/**
 * GET /api/memberships
 * Mengambil daftar langganan membership aktif pelanggan
 */
export const getMemberships = async (req, res) => {
  try {
    const { customer_id, outlet_id, status } = req.query;

    let sql = `
      SELECT m.*, 
             c.name as customer_name, 
             c.phone as customer_phone, 
             c.tier as customer_tier,
             p.name as package_name,
             p.package_type,
             p.price as package_price
      FROM tr_membership m
      LEFT JOIN mst_customer c ON m.customer_id = c.id
      LEFT JOIN mst_membership_package p ON m.package_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (customer_id) {
      sql += ' AND m.customer_id = ?';
      params.push(customer_id);
    }

    if (outlet_id && outlet_id !== 'Semua') {
      sql += ' AND m.outlet_id = ?';
      params.push(outlet_id);
    }

    if (status && status !== 'Semua') {
      sql += ' AND m.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY m.id DESC';

    const [rows] = await myWaschenPool.query(sql, params);
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching memberships:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data membership pelanggan',
      error: error.message
    });
  }
};

/**
 * POST /api/memberships
 * Mendaftarkan / membeli paket membership baru untuk pelanggan
 */
export const createMembership = async (req, res) => {
  try {
    const { customerId, packageId, outletId } = req.body;

    if (!customerId || !packageId) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID dan Package ID wajib diisi'
      });
    }

    const [pkgRows] = await myWaschenPool.query(
      'SELECT * FROM mst_membership_package WHERE id = ?',
      [packageId]
    );

    if (pkgRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Paket membership tidak ditemukan' });
    }

    const pkg = pkgRows[0];
    const validityDays = pkg.validity_days || 90;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + validityDays);

    const [result] = await myWaschenPool.query(
      `INSERT INTO tr_membership 
       (customer_id, package_id, outlet_id, start_date, end_date, initial_quota_kg, remaining_quota_kg, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [
        customerId,
        packageId,
        outletId || 2,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        pkg.quota_kg || 0,
        pkg.quota_kg || 0
      ]
    );

    // Update customer tier & deposit balance based on package
    const newTier = pkg.target_tier || (parseFloat(pkg.price) >= 1000000 ? 'Diamond' : 'Gold');
    const depositValue = parseFloat(pkg.deposit_value) || 0;
    await myWaschenPool.query(
      "UPDATE mst_customer SET tier = ?, deposit_balance = deposit_balance + ?, updated_at = NOW() WHERE id = ?",
      [newTier, depositValue, customerId]
    );

    return res.status(201).json({
      success: true,
      message: `Paket ${pkg.name} berhasil diaktifkan untuk pelanggan`,
      data: {
        membershipId: result.insertId,
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Error creating membership:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengaktifkan paket membership',
      error: error.message
    });
  }
};
