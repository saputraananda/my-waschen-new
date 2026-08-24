import { myWaschenPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import { normalizePhone, composeFullAddress } from '../utils/phone.js';

const CUSTOMER_SELECT = `
  SELECT c.*,
         st.id AS spending_tier_id,
         st.code AS spending_tier_code,
         st.name AS tier,
         st.label AS tier_label,
         cs.id AS customer_source_id,
         cs.code AS source_code,
         cs.name AS source_name,
         cs.label AS source,
         mpkg.tier AS membership_tier,
         mpkg.name AS membership_package_name,
         mpkg.top_up_amount AS membership_top_up_amount,
         am.start_date AS membership_start_date,
         am.end_date AS membership_end_date,
         am.status AS membership_status,
         COALESCE(trx.trx_count, 0) AS trx_count_live,
         COALESCE(trx.total_spent_live, 0) AS total_spent_live,
         trx.last_order_date
  FROM mst_customer c
  LEFT JOIN mst_customer_tier st ON c.spending_tier_id = st.id
  LEFT JOIN mst_customer_source cs ON c.customer_source_id = cs.id
  LEFT JOIN tr_membership am ON c.active_membership_id = am.id AND am.status = 'Active'
  LEFT JOIN mst_membership_package mpkg ON am.package_id = mpkg.id
  LEFT JOIN (
    SELECT customer_id,
           COUNT(*) AS trx_count,
           COALESCE(SUM(grand_total), 0) AS total_spent_live,
           MAX(order_date) AS last_order_date
    FROM tr_transaction
    GROUP BY customer_id
  ) trx ON trx.customer_id = c.id
`;

const resolveSpendingTierId = async (tierId, tierName) => {
  if (tierId) {
    const [rows] = await myWaschenPool.query(
      'SELECT id FROM mst_customer_tier WHERE id = ? AND is_active = 1 LIMIT 1',
      [tierId]
    );
    if (rows.length) return rows[0].id;
  }
  if (tierName) {
    const [rows] = await myWaschenPool.query(
      `SELECT id FROM mst_customer_tier
       WHERE is_active = 1 AND (name = ? OR code = ? OR label = ?)
       LIMIT 1`,
      [tierName, String(tierName).toUpperCase().replace(/-/g, '_'), tierName]
    );
    if (rows.length) return rows[0].id;
  }
  const [defaultTier] = await myWaschenPool.query(
    "SELECT id FROM mst_customer_tier WHERE code = 'ONE_TIME' LIMIT 1"
  );
  return defaultTier[0]?.id || 4;
};

const resolveSourceId = async (sourceId, sourceName) => {
  if (sourceId) {
    const [rows] = await myWaschenPool.query(
      'SELECT id FROM mst_customer_source WHERE id = ? AND is_active = 1 LIMIT 1',
      [sourceId]
    );
    if (rows.length) return rows[0].id;
  }
  if (sourceName) {
    const [rows] = await myWaschenPool.query(
      `SELECT id FROM mst_customer_source
       WHERE is_active = 1 AND (name = ? OR label = ? OR code = ?)
       LIMIT 1`,
      [sourceName, sourceName, String(sourceName).toUpperCase()]
    );
    if (rows.length) return rows[0].id;
  }
  return null;
};

/**
 * GET /api/customers
 */
export const getCustomers = async (req, res) => {
  try {
    const { search, tier, tier_id, outlet_id, has_membership } = req.query;
    let sql = `${CUSTOMER_SELECT} WHERE c.is_active = 1`;
    const params = [];

    if (search && search.trim()) {
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ? OR c.email LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    if (tier_id) {
      sql += ' AND c.spending_tier_id = ?';
      params.push(tier_id);
    } else if (tier && tier !== 'Semua') {
      sql += ' AND (st.name = ? OR st.code = ?)';
      params.push(tier, String(tier).toUpperCase().replace(/-/g, '_'));
    }

    if (has_membership === '1' || has_membership === 'true') {
      sql += ' AND c.active_membership_id IS NOT NULL';
    }

    if (outlet_id) {
      sql += ' AND (c.preferred_outlet_id = ? OR c.preferred_outlet_id IS NULL)';
      params.push(outlet_id);
    }

    sql += ' ORDER BY c.id DESC';

    const [rows] = await myWaschenPool.query(sql, params);
    return res.status(200).json({ success: true, data: rows });
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
 */
export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const [custRows] = await myWaschenPool.query(
      `${CUSTOMER_SELECT} WHERE c.id = ? OR c.customer_code = ? LIMIT 1`,
      [id, id]
    );

    if (custRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
    }

    const customer = custRows[0];
    const [orders] = await myWaschenPool.query(
      `SELECT t.id, t.order_no, t.order_category, t.total_weight_kg, t.total_pcs,
              t.grand_total, t.payment_status, t.work_status, t.order_date, t.outlet_id,
              COALESCE(o.full_name, o.name, 'Outlet Waschen') AS outlet_name,
              GROUP_CONCAT(
                DISTINCT NULLIF(TRIM(d.service_name), '')
                ORDER BY d.id ASC
                SEPARATOR ', '
              ) AS item_names
       FROM tr_transaction t
       LEFT JOIN tr_transaction_detail d ON d.transaction_id = t.id
       LEFT JOIN mst_outlet o ON o.id = t.outlet_id
       WHERE t.customer_id = ?
       GROUP BY t.id
       ORDER BY t.order_date DESC, t.id DESC
       LIMIT 20`,
      [customer.id]
    );

    customer.history = orders.map((o) => {
      const qtyLabel = parseFloat(o.total_weight_kg) > 0
        ? `${parseFloat(o.total_weight_kg)} Kg`
        : `${parseFloat(o.total_pcs) || 0} Pcs`;
      const itemsLabel = o.item_names
        ? o.item_names
        : `${o.order_category || 'Laundry'} (${qtyLabel})`;
      return {
        orderId: o.order_no,
        dbId: o.id,
        amount: parseFloat(o.grand_total) || 0,
        date: new Date(o.order_date).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        items: itemsLabel,
        category: o.order_category,
        paymentStatus: o.payment_status,
        workStatus: o.work_status,
        outletId: o.outlet_id,
        branch: o.outlet_name || 'Outlet Waschen'
      };
    });

    return res.status(200).json({ success: true, data: customer });
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
 */
export const createCustomer = async (req, res) => {
  try {
    const {
      name,
      phone,
      gender,
      greeting,
      email,
      birthDate,
      occupation,
      address,
      block,
      houseNumber,
      fullAddress,
      district,
      subDistrict,
      city,
      postalCode,
      landmark,
      notes,
      generalNotes,
      homeBranch,
      preferredOutletId,
      spendingTierId,
      customerTierId,
      tierId,
      tier,
      customerSourceId,
      sourceId,
      source,
      depositBalance
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Nama dan Nomor Telepon pelanggan wajib diisi'
      });
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Nomor telepon tidak valid'
      });
    }

    const [dup] = await myWaschenPool.query(
      'SELECT id FROM mst_customer WHERE phone = ? LIMIT 1',
      [cleanPhone]
    );
    if (dup.length) {
      return res.status(409).json({
        success: false,
        message: `Nomor ${cleanPhone} sudah terdaftar`
      });
    }

    const resolvedTierId = await resolveSpendingTierId(
      spendingTierId || customerTierId || tierId,
      tier
    );
    const resolvedSourceId = await resolveSourceId(customerSourceId || sourceId, source);
    const composedAddress = fullAddress?.trim()
      || composeFullAddress({ address, block, houseNumber, district, subDistrict, city, postalCode })
      || null;

    const [countRows] = await myWaschenPool.query('SELECT COUNT(*) as total FROM mst_customer');
    const nextNum = (countRows[0].total || 0) + 1;
    const customerCode = `CUST-${String(nextNum).padStart(3, '0')}`;

    const [result] = await myWaschenPool.query(
      `INSERT INTO mst_customer
       (customer_code, name, phone, gender, greeting, email, birth_date, occupation,
        address, block, house_number, full_address, district, sub_district, city, postal_code,
        landmark, home_branch, preferred_outlet_id, spending_tier_id, customer_source_id,
        notes, general_notes, deposit_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerCode,
        name.trim(),
        cleanPhone,
        gender || null,
        greeting || null,
        email || null,
        birthDate || null,
        occupation || null,
        address || null,
        block || null,
        houseNumber || null,
        composedAddress,
        district || null,
        subDistrict || null,
        city || null,
        postalCode || null,
        landmark || null,
        homeBranch || null,
        preferredOutletId || null,
        resolvedTierId,
        resolvedSourceId,
        notes || null,
        generalNotes || null,
        parseFloat(depositBalance) || 0
      ]
    );

    const [newCustomer] = await myWaschenPool.query(
      `${CUSTOMER_SELECT} WHERE c.id = ?`,
      [result.insertId]
    );

    emitDashboardRefresh('customer:updated', {
      outletId: preferredOutletId || newCustomer[0]?.preferred_outlet_id,
      customerId: result.insertId
    });

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
 */
export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      gender,
      greeting,
      email,
      birthDate,
      occupation,
      address,
      block,
      houseNumber,
      fullAddress,
      district,
      subDistrict,
      city,
      postalCode,
      landmark,
      notes,
      generalNotes,
      homeBranch,
      preferredOutletId,
      spendingTierId,
      customerTierId,
      tierId,
      tier,
      customerSourceId,
      sourceId,
      source
    } = req.body;

    const cleanPhone = phone ? normalizePhone(phone) : null;
    if (phone && (!cleanPhone || cleanPhone.length < 10)) {
      return res.status(400).json({ success: false, message: 'Nomor telepon tidak valid' });
    }
    if (cleanPhone) {
      const [dup] = await myWaschenPool.query(
        'SELECT id FROM mst_customer WHERE phone = ? AND id != ? LIMIT 1',
        [cleanPhone, id]
      );
      if (dup.length) {
        return res.status(409).json({ success: false, message: `Nomor ${cleanPhone} sudah terdaftar` });
      }
    }

    const resolvedTierId = (spendingTierId || customerTierId || tierId || tier)
      ? await resolveSpendingTierId(spendingTierId || customerTierId || tierId, tier)
      : null;
    const resolvedSourceId = (customerSourceId || sourceId || source)
      ? await resolveSourceId(customerSourceId || sourceId, source)
      : null;
    const composedAddress = fullAddress !== undefined
      ? (fullAddress?.trim() || composeFullAddress({ address, block, houseNumber, district, subDistrict, city, postalCode }) || null)
      : undefined;

    await myWaschenPool.query(
      `UPDATE mst_customer
       SET name = COALESCE(?, name),
           phone = COALESCE(?, phone),
           gender = COALESCE(?, gender),
           greeting = COALESCE(?, greeting),
           email = COALESCE(?, email),
           birth_date = COALESCE(?, birth_date),
           occupation = COALESCE(?, occupation),
           address = COALESCE(?, address),
           block = COALESCE(?, block),
           house_number = COALESCE(?, house_number),
           full_address = COALESCE(?, full_address),
           district = COALESCE(?, district),
           sub_district = COALESCE(?, sub_district),
           city = COALESCE(?, city),
           postal_code = COALESCE(?, postal_code),
           landmark = COALESCE(?, landmark),
           home_branch = COALESCE(?, home_branch),
           preferred_outlet_id = COALESCE(?, preferred_outlet_id),
           spending_tier_id = COALESCE(?, spending_tier_id),
           customer_source_id = COALESCE(?, customer_source_id),
           notes = COALESCE(?, notes),
           general_notes = COALESCE(?, general_notes),
           updated_at = NOW()
       WHERE id = ?`,
      [
        name || null,
        cleanPhone,
        gender || null,
        greeting || null,
        email || null,
        birthDate || null,
        occupation || null,
        address !== undefined ? address : null,
        block !== undefined ? block : null,
        houseNumber !== undefined ? houseNumber : null,
        composedAddress !== undefined ? composedAddress : null,
        district !== undefined ? district : null,
        subDistrict !== undefined ? subDistrict : null,
        city || null,
        postalCode || null,
        landmark !== undefined ? landmark : null,
        homeBranch || null,
        preferredOutletId || null,
        resolvedTierId,
        resolvedSourceId,
        notes !== undefined ? notes : null,
        generalNotes !== undefined ? generalNotes : null,
        id
      ]
    );

    const [updated] = await myWaschenPool.query(`${CUSTOMER_SELECT} WHERE c.id = ?`, [id]);

    emitDashboardRefresh('customer:updated', {
      outletId: updated[0]?.preferred_outlet_id,
      customerId: Number(id)
    });

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

    await myWaschenPool.query(
      'UPDATE mst_customer SET deposit_balance = ?, updated_at = NOW() WHERE id = ?',
      [balanceAfter, id]
    );

    await myWaschenPool.query(
      `INSERT INTO tr_customer_deposit
       (customer_id, outlet_id, cashier_employee_id, type, amount, balance_before, balance_after, payment_method, notes)
       VALUES (?, ?, ?, 'Topup', ?, ?, ?, ?, ?)`,
      [id, outletId || null, cashierEmployeeId || null, numAmount, balanceBefore, balanceAfter, paymentMethod || 'Tunai', notes || 'Top-up saldo deposit kasir']
    );

    emitDashboardRefresh('customer:updated', {
      outletId: outletId || null,
      customerId: Number(id)
    });

    return res.status(200).json({
      success: true,
      message: `Berhasil top-up deposit Rp ${numAmount.toLocaleString('id-ID')}`,
      data: { customerId: id, balanceBefore, balanceAfter }
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
