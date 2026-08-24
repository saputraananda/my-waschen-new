import { myWaschenPool } from '../db/pool.js';

/**
 * GET /api/memberships/packages
 */
export const getMembershipPackages = async (req, res) => {
  try {
    const [rows] = await myWaschenPool.query(
      'SELECT * FROM mst_membership_package WHERE is_active = 1 ORDER BY top_up_amount ASC'
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
 */
export const getMemberships = async (req, res) => {
  try {
    const { customer_id, outlet_id, status } = req.query;

    let sql = `
      SELECT m.*,
             c.name as customer_name,
             c.phone as customer_phone,
             st.name as spending_tier,
             p.name as package_name,
             p.tier as membership_tier,
             p.top_up_amount as package_top_up_amount
      FROM tr_membership m
      LEFT JOIN mst_customer c ON m.customer_id = c.id
      LEFT JOIN mst_customer_tier st ON c.spending_tier_id = st.id
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
 */
export const createMembership = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const {
      customerId,
      packageId,
      outletId,
      paymentMethod,
      cashierEmployeeId
    } = req.body;

    if (!customerId || !packageId) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID dan Package ID wajib diisi'
      });
    }

    await connection.beginTransaction();

    const [pkgRows] = await connection.query(
      'SELECT * FROM mst_membership_package WHERE id = ? AND is_active = 1',
      [packageId]
    );

    if (pkgRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Paket membership tidak ditemukan' });
    }

    const pkg = pkgRows[0];
    const topUpAmount = parseFloat(pkg.top_up_amount) || 0;
    const validityDays = pkg.validity_days || 180;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + validityDays);

    const [custRows] = await connection.query(
      'SELECT id, deposit_balance, active_membership_id FROM mst_customer WHERE id = ? LIMIT 1',
      [customerId]
    );
    if (!custRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
    }

    const customer = custRows[0];
    const balanceBefore = parseFloat(customer.deposit_balance) || 0;
    const balanceAfter = balanceBefore + topUpAmount;

    if (customer.active_membership_id) {
      await connection.query(
        "UPDATE tr_membership SET status = 'Cancelled', updated_at = NOW() WHERE id = ?",
        [customer.active_membership_id]
      );
    }

    const [result] = await connection.query(
      `INSERT INTO tr_membership
       (customer_id, package_id, outlet_id, start_date, end_date, top_up_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [
        customerId,
        packageId,
        outletId || 2,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        topUpAmount
      ]
    );

    const membershipId = result.insertId;

    await connection.query(
      `UPDATE mst_customer
       SET active_membership_id = ?,
           deposit_balance = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [membershipId, balanceAfter, customerId]
    );

    await connection.query(
      `INSERT INTO tr_customer_deposit
       (customer_id, outlet_id, cashier_employee_id, type, amount, balance_before, balance_after, payment_method, membership_id, notes)
       VALUES (?, ?, ?, 'Topup', ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        outletId || null,
        cashierEmployeeId || null,
        topUpAmount,
        balanceBefore,
        balanceAfter,
        paymentMethod || 'Tunai',
        membershipId,
        `Aktivasi paket ${pkg.name}`
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `Paket ${pkg.name} berhasil diaktifkan untuk pelanggan`,
      data: {
        membershipId,
        membershipTier: pkg.tier,
        topUpAmount,
        startDate,
        endDate
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating membership:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengaktifkan paket membership',
      error: error.message
    });
  } finally {
    connection.release();
  }
};
