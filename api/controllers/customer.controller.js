import { myWaschenPool } from '../db/pool.js';

/**
 * GET /api/customers
 * Mengambil daftar customer dengan filter search, tier, dan outlet
 */
export const getCustomers = async (req, res) => {
  try {
    const { search, tier, outlet_id } = req.query;
    let sql = 'SELECT * FROM mst_customer WHERE is_active = 1';
    const params = [];

    if (search && search.trim()) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR customer_code LIKE ? OR email LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    if (tier && tier !== 'Semua') {
      sql += ' AND tier = ?';
      params.push(tier);
    }

    if (outlet_id) {
      sql += ' AND (preferred_outlet_id = ? OR preferred_outlet_id IS NULL)';
      params.push(outlet_id);
    }

    sql += ' ORDER BY id DESC';

    const [rows] = await myWaschenPool.query(sql, params);
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data pelanggan',
      error: error.message
    });
  }
};

/**
 * GET /api/customers/:id
 * Mengambil detail pelanggan beserta riwayat transaksi nota
 */
export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const [custRows] = await myWaschenPool.query(
      'SELECT * FROM mst_customer WHERE id = ? OR customer_code = ? LIMIT 1',
      [id, id]
    );

    if (custRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pelanggan tidak ditemukan'
      });
    }

    const customer = custRows[0];

    // Ambil riwayat order pelanggan
    const [orders] = await myWaschenPool.query(
      `SELECT id, order_no, order_category, total_weight_kg, total_pcs, grand_total, payment_status, work_status, order_date 
       FROM tr_transaction 
       WHERE customer_id = ? 
       ORDER BY order_date DESC LIMIT 10`,
      [customer.id]
    );

    customer.history = orders.map(o => ({
      orderId: o.order_no,
      amount: o.grand_total,
      date: new Date(o.order_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      items: `${o.order_category} (${o.total_weight_kg > 0 ? `${o.total_weight_kg} Kg` : `${o.total_pcs} Pcs`})`
    }));

    return res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error fetching customer detail:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil detail pelanggan',
      error: error.message
    });
  }
};

/**
 * POST /api/customers
 * Tambah pelanggan baru
 */
export const createCustomer = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      city,
      postalCode,
      landmark,
      homeBranch,
      preferredOutletId,
      tier,
      source,
      perfumePreference,
      workPreference,
      notes,
      depositBalance
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Nama dan Nomor Telepon pelanggan wajib diisi'
      });
    }

    // Generate next customer code
    const [countRows] = await myWaschenPool.query('SELECT COUNT(*) as total FROM mst_customer');
    const nextNum = (countRows[0].total || 0) + 1;
    const customerCode = `CUST-${String(nextNum).padStart(3, '0')}`;

    const [result] = await myWaschenPool.query(
      `INSERT INTO mst_customer 
       (customer_code, name, phone, email, address, city, postal_code, landmark, home_branch, preferred_outlet_id, tier, source, perfume_preference, work_preference, notes, deposit_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerCode,
        name.trim(),
        phone.trim(),
        email || null,
        address || null,
        city || 'Jakarta Selatan',
        postalCode || null,
        landmark || null,
        homeBranch || null,
        preferredOutletId || null,
        tier || 'Reguler',
        source || 'Langsung ke Toko',
        perfumePreference || 'Standar',
        workPreference || 'Standard Reguler',
        notes || null,
        parseFloat(depositBalance) || 0
      ]
    );

    const [newCustomer] = await myWaschenPool.query('SELECT * FROM mst_customer WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Pelanggan baru berhasil didaftarkan',
      data: newCustomer[0]
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menambahkan pelanggan baru',
      error: error.message
    });
  }
};

/**
 * PUT /api/customers/:id
 * Update data pelanggan
 */
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      email,
      address,
      city,
      postalCode,
      landmark,
      homeBranch,
      preferredOutletId,
      tier,
      perfumePreference,
      workPreference,
      notes
    } = req.body;

    await myWaschenPool.query(
      `UPDATE mst_customer 
       SET name = COALESCE(?, name),
           phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           address = COALESCE(?, address),
           city = COALESCE(?, city),
           postal_code = COALESCE(?, postal_code),
           landmark = COALESCE(?, landmark),
           home_branch = COALESCE(?, home_branch),
           preferred_outlet_id = COALESCE(?, preferred_outlet_id),
           tier = COALESCE(?, tier),
           perfume_preference = COALESCE(?, perfume_preference),
           work_preference = COALESCE(?, work_preference),
           notes = COALESCE(?, notes),
           updated_at = NOW()
       WHERE id = ?`,
      [
        name,
        phone,
        email,
        address,
        city,
        postalCode,
        landmark,
        homeBranch,
        preferredOutletId,
        tier,
        perfumePreference,
        workPreference,
        notes,
        id
      ]
    );

    const [updated] = await myWaschenPool.query('SELECT * FROM mst_customer WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Data pelanggan berhasil diperbarui',
      data: updated[0]
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui data pelanggan',
      error: error.message
    });
  }
};

/**
 * POST /api/customers/:id/deposit
 * Top-up saldo deposit pelanggan
 */
export const topupDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, notes, cashierEmployeeId, outletId } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Nominal top-up harus berupa angka positif'
      });
    }

    const [custRows] = await myWaschenPool.query('SELECT * FROM mst_customer WHERE id = ?', [id]);
    if (custRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
    }

    const customer = custRows[0];
    const balanceBefore = parseFloat(customer.deposit_balance || 0);
    const balanceAfter = balanceBefore + numAmount;

    // Update customer deposit
    await myWaschenPool.query(
      'UPDATE mst_customer SET deposit_balance = ?, updated_at = NOW() WHERE id = ?',
      [balanceAfter, id]
    );

    // Record in tr_customer_deposit
    await myWaschenPool.query(
      `INSERT INTO tr_customer_deposit 
       (customer_id, outlet_id, cashier_employee_id, type, amount, balance_before, balance_after, payment_method, notes)
       VALUES (?, ?, ?, 'Topup', ?, ?, ?, ?, ?)`,
      [id, outletId || null, cashierEmployeeId || null, numAmount, balanceBefore, balanceAfter, paymentMethod || 'Tunai', notes || 'Top-up saldo deposit kasir']
    );

    return res.status(200).json({
      success: true,
      message: `Berhasil top-up deposit Rp ${numAmount.toLocaleString('id-ID')}`,
      data: {
        customerId: id,
        balanceBefore,
        balanceAfter
      }
    });
  } catch (error) {
    console.error('Error top-up deposit:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal melakukan top-up deposit',
      error: error.message
    });
  }
};
