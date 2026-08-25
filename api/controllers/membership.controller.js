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
 * Aktivasi / Top-Up Paket Membership Pelanggan
 * Rules:
 * 1. Menambah saldo deposit sebesar nominal pas paket (500K untuk Gold, 1M untuk Diamond).
 * 2. Highest Tier Retention: Jika pelanggan sedang berada di Tier DIAMOND dan melakukan top-up paket GOLD (500K),
 *    saldo deposit bertambah +500K, masa aktif diperpanjang, namun tier pelanggan TETAP DIAMOND (retensi tier tertinggi).
 * 3. Mengupdate masa aktif (validity_days) dari tanggal kadaluarsa sebelumnya atau hari ini.
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

    // 1. Ambil detail paket membership yang dipilih
    const [pkgRows] = await connection.query(
      'SELECT * FROM mst_membership_package WHERE id = ? AND is_active = 1',
      [packageId]
    );

    if (pkgRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Paket membership tidak ditemukan' });
    }

    const requestedPkg = pkgRows[0];
    const topUpAmount = parseFloat(requestedPkg.top_up_amount) || 0;
    const validityDays = requestedPkg.validity_days || 180;

    // Bonus Saldo Deposit:
    // Paket Gold (500K) -> Bonus Rp 25.000 (Total saldo bertambah +525.000)
    // Paket Diamond (1M) -> Bonus Rp 50.000 (Total saldo bertambah +1.050.000)
    let bonusAmount = 0;
    if (String(requestedPkg.tier).toLowerCase().includes('diamond') || topUpAmount >= 1000000) {
      bonusAmount = 50000;
    } else if (String(requestedPkg.tier).toLowerCase().includes('gold') || topUpAmount >= 500000) {
      bonusAmount = 25000;
    }

    const totalCredit = topUpAmount + bonusAmount;

    // 2. Ambil detail pelanggan & status membership aktif saat ini
    const [custRows] = await connection.query(
      `SELECT c.id, c.name, c.deposit_balance, c.active_membership_id,
              m.id as active_m_id, m.end_date as active_end_date, m.package_id as active_pkg_id,
              mpkg.tier as active_tier
       FROM mst_customer c
       LEFT JOIN tr_membership m ON c.active_membership_id = m.id AND m.status = 'Active' AND m.end_date >= CURDATE()
       LEFT JOIN mst_membership_package mpkg ON m.package_id = mpkg.id
       WHERE c.id = ? LIMIT 1`,
      [customerId]
    );

    if (!custRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
    }

    const customer = custRows[0];
    const balanceBefore = parseFloat(customer.deposit_balance) || 0;
    const balanceAfter = balanceBefore + totalCredit;

    // Hierarchy Tier: Diamond (Rank 2) > Gold (Rank 1)
    const TIER_RANK = { 'Gold': 1, 'Diamond': 2 };
    const currentTier = customer.active_tier || null;
    const currentRank = currentTier ? (TIER_RANK[currentTier] || 1) : 0;
    const requestedRank = TIER_RANK[requestedPkg.tier] || 1;

    let finalPackageId = requestedPkg.id;
    let finalTier = requestedPkg.tier;

    // Highest Tier Retention Rule:
    // Jika pelanggan sudah memiliki Tier lebih tinggi (misal Diamond) lalu top up paket lebih rendah (Gold),
    // maka paket yang di-assign tetap mempertahankan paket/tier tertinggi (Diamond).
    if (customer.active_m_id && currentRank > requestedRank) {
      finalPackageId = customer.active_pkg_id;
      finalTier = currentTier;
    }

    // Hitung tanggal akhir (end_date)
    const today = new Date();
    let startDate = today;
    let endDate = new Date();

    if (customer.active_end_date && new Date(customer.active_end_date) > today) {
      // Perpanjang dari tanggal kadaluarsa aktif saat ini
      const baseDate = new Date(customer.active_end_date);
      baseDate.setDate(baseDate.getDate() + validityDays);
      endDate = baseDate;
    } else {
      endDate.setDate(today.getDate() + validityDays);
    }

    // Nonaktifkan record membership lama jika ada
    if (customer.active_membership_id) {
      await connection.query(
        "UPDATE tr_membership SET status = 'Cancelled', updated_at = NOW() WHERE id = ?",
        [customer.active_membership_id]
      );
    }

    // Buat record membership baru yang aktif
    const [result] = await connection.query(
      `INSERT INTO tr_membership
       (customer_id, package_id, outlet_id, start_date, end_date, top_up_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [
        customerId,
        finalPackageId,
        outletId || 2,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        topUpAmount
      ]
    );

    const membershipId = result.insertId;

    // Update active_membership_id & saldo deposit pelanggan di mst_customer
    await connection.query(
      `UPDATE mst_customer
       SET active_membership_id = ?,
           deposit_balance = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [membershipId, balanceAfter, customerId]
    );

    // Catat mutasi deposit
    await connection.query(
      `INSERT INTO tr_customer_deposit
       (customer_id, outlet_id, cashier_employee_id, type, amount, balance_before, balance_after, payment_method, membership_id, notes)
       VALUES (?, ?, ?, 'Topup', ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        outletId || null,
        cashierEmployeeId || null,
        totalCredit,
        balanceBefore,
        balanceAfter,
        paymentMethod || 'Tunai',
        membershipId,
        `Top Up Paket ${requestedPkg.name} (Setoran Rp ${topUpAmount.toLocaleString('id-ID')} + Bonus Rp ${bonusAmount.toLocaleString('id-ID')})`
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `Top-up paket ${requestedPkg.name} berhasil! Setoran Rp ${topUpAmount.toLocaleString('id-ID')} + Bonus Saldo Rp ${bonusAmount.toLocaleString('id-ID')}. Total saldo bertambah +Rp ${totalCredit.toLocaleString('id-ID')}. Status Membership: ${finalTier.toUpperCase()}`,
      data: {
        membershipId,
        membershipTier: finalTier,
        topUpAmount,
        bonusAmount,
        totalCredit,
        balanceAfter,
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
