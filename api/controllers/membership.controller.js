import { myWaschenPool } from '../db/pool.js';
import { todayWibISO, toWibDateKey, addWibDays } from '../utils/wib.js';

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
 * 1. Menambah saldo deposit sebesar nominal pas paket (500K untuk Gold, 1M untuk Diamond) + bonus.
 * 2. Highest Tier Retention: Jika pelanggan sedang berada di Tier DIAMOND dan melakukan top-up paket GOLD (500K),
 *    saldo deposit bertambah +500K, masa aktif diperpanjang, namun tier pelanggan TETAP DIAMOND (retensi tier tertinggi).
 * 3. Mengupdate masa aktif (validity_days) dari tanggal kadaluarsa sebelumnya atau hari ini.
 * 4. Kelebihan bayar (paidAmount > top_up_amount):
 *    - change  → kembalian tunai (tidak masuk saldo)
 *    - deposit → kelebihan ditambahkan ke saldo deposit
 *    - refund  → kelebihan dicatat menunggu refund (tidak masuk saldo)
 */
export const createMembership = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const {
      customerId,
      packageId,
      outletId,
      paymentMethod,
      cashierEmployeeId,
      paidAmount: paidAmountRaw,
      overpaymentAction: overpaymentActionRaw
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

    const paidAmount = paidAmountRaw !== undefined && paidAmountRaw !== null && paidAmountRaw !== ''
      ? Math.round(parseFloat(paidAmountRaw) || 0)
      : topUpAmount;
    const overpaymentAction = String(overpaymentActionRaw || 'change').toLowerCase();

    if (/saldo\s*member/i.test(String(paymentMethod || ''))) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Aktivasi/top-up membership tidak bisa memakai Potong Saldo Member.'
      });
    }

    if (paidAmount < topUpAmount) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Nominal bayar kurang. Minimal Rp ${topUpAmount.toLocaleString('id-ID')} (harga paket).`
      });
    }

    const excess = Math.max(0, Math.round((paidAmount - topUpAmount) * 100) / 100);
    let changeAmount = 0;
    let excessToDeposit = 0;
    let refundAmount = 0;

    if (excess > 0) {
      if (overpaymentAction === 'deposit') {
        excessToDeposit = excess;
      } else if (overpaymentAction === 'refund') {
        refundAmount = excess;
      } else {
        changeAmount = excess;
      }
    }

    const totalCredit = topUpAmount + bonusAmount + excessToDeposit;

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

    const excessNote = excessToDeposit > 0
      ? ` + Kelebihan bayar Rp ${excessToDeposit.toLocaleString('id-ID')} (simpan ke saldo)`
      : changeAmount > 0
        ? ` | Kembalian tunai Rp ${changeAmount.toLocaleString('id-ID')}`
        : refundAmount > 0
          ? ` | Kelebihan Rp ${refundAmount.toLocaleString('id-ID')} menunggu refund`
          : '';
    const depositNotes = `Top Up Paket ${requestedPkg.name} (Bayar Rp ${paidAmount.toLocaleString('id-ID')} → Setoran paket Rp ${topUpAmount.toLocaleString('id-ID')} + Bonus Rp ${bonusAmount.toLocaleString('id-ID')}${excessNote})`;

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

    // Hitung tanggal akhir (end_date) — kalender WIB
    const todayKey = todayWibISO();
    let startDate = todayKey;
    let endDate;

    const activeEndKey = toWibDateKey(customer.active_end_date);
    if (activeEndKey && activeEndKey > todayKey) {
      // Perpanjang dari tanggal kadaluarsa aktif saat ini
      endDate = addWibDays(activeEndKey, validityDays);
    } else {
      endDate = addWibDays(todayKey, validityDays);
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
        startDate,
        endDate,
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
        depositNotes
      ]
    );

    await connection.commit();

    const extrasMsg = excessToDeposit > 0
      ? ` Kelebihan Rp ${excessToDeposit.toLocaleString('id-ID')} disimpan ke saldo.`
      : changeAmount > 0
        ? ` Kembalian tunai Rp ${changeAmount.toLocaleString('id-ID')}.`
        : refundAmount > 0
          ? ` Kelebihan Rp ${refundAmount.toLocaleString('id-ID')} menunggu refund.`
          : '';

    return res.status(201).json({
      success: true,
      message: `Top-up paket ${requestedPkg.name} berhasil! Setoran Rp ${topUpAmount.toLocaleString('id-ID')} + Bonus Saldo Rp ${bonusAmount.toLocaleString('id-ID')}. Total saldo bertambah +Rp ${totalCredit.toLocaleString('id-ID')}.${extrasMsg} Status Membership: ${finalTier.toUpperCase()}`,
      data: {
        membershipId,
        membershipTier: finalTier,
        topUpAmount,
        bonusAmount,
        paidAmount,
        excess,
        excessToDeposit,
        changeAmount,
        refundAmount,
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
