import { myWaschenPool, mainPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import { applyTransactionSpendingUpdate } from '../utils/spendingTier.js';
import { applyDepositOnPayment } from '../utils/customerDeposit.js';
import { insertPaymentLog, resolvePaymentStatus } from '../utils/paymentLog.js';
import { computeAccumulatedWorkPercentage, refreshHeaderWorkPercentage, nextLifecycleStatus, workStatusTabSql } from '../utils/workStatus.js';

/**
 * Helper to generate order number (nota):
 * Format: WL{outlet_code}{YYYYMMDD}{sequence 4 digit} (Tanpa Strip)
 * Example: WLRH202608250001, WLCG202608250001
 */
const generateOrderNo = async (outletId = 2) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  // 1. Get outlet_code from DB
  let outletCode = 'CG';
  try {
    const [outlets] = await myWaschenPool.query(
      'SELECT outlet_code, name FROM mst_outlet WHERE id = ? LIMIT 1',
      [outletId]
    );
    if (outlets.length > 0) {
      if (outlets[0].outlet_code) {
        outletCode = outlets[0].outlet_code;
      } else if (outlets[0].name) {
        const name = outlets[0].name.trim();
        const words = name.split(/\s+/);
        outletCode = words.length > 1
          ? words.map(w => w[0].toUpperCase()).join('')
          : words[0].slice(0, 3).toUpperCase();
      }
    }
  } catch (e) {
    console.error('Error fetching outlet_code for order_no:', e.message);
  }

  const prefix = `WL${outletCode}${dateStr}`;

  const [rows] = await myWaschenPool.query(
    'SELECT order_no FROM tr_transaction WHERE order_no LIKE ? ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );

  let seq = 1;
  if (rows.length > 0 && rows[0].order_no) {
    const lastNo = rows[0].order_no;
    const lastSeqStr = lastNo.slice(prefix.length);
    const lastSeq = parseInt(lastSeqStr, 10) || 0;
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
};

/**
 * POST /api/transactions
 * Buat transaksi nota POS baru (Step 4 Checkout)
 */
export const createTransaction = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      customerId,
      outletId,
      cashierEmployeeId,
      shiftId,
      orderCategory,
      totalWeightKg,
      totalPcs,
      speedId,
      speedName,
      parfumeId,
      parfumeName,
      subtotal,
      speedSurcharge,
      discountAmount,
      discountNotes,
      grandTotal,
      paymentStatus,
      paymentMethod,
      paidAmount,
      changeAmount,
      overpaymentToDeposit,
      paymentProofUrl,
      isDelivery,
      deliveryAddress,
      deliveryNotes,
      specialNotes,
      items
    } = req.body;

    if (!customerId || !items || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Customer ID dan rincian item keranjang wajib diisi'
      });
    }

    const resolvedCustomerId = parseInt(customerId, 10);
    if (!resolvedCustomerId || Number.isNaN(resolvedCustomerId)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Customer ID tidak valid. Pilih ulang pelanggan dari daftar.'
      });
    }

    const [custCheck] = await connection.query(
      'SELECT id, name, phone FROM mst_customer WHERE id = ? AND is_active = 1 LIMIT 1',
      [resolvedCustomerId]
    );
    if (!custCheck.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pelanggan tidak ditemukan di database'
      });
    }

    const orderNo = await generateOrderNo(outletId);
    const grandTotalNum = parseFloat(grandTotal) || 0;
    const isOutstanding = paymentStatus === 'Outstanding';
    const isLunas = paymentStatus === 'Lunas';
    const isDP = paymentStatus === 'DP';

    if (!isOutstanding && !isLunas && !isDP) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Status pembayaran wajib Lunas, DP, atau Outstanding'
      });
    }

    let resolvedPaidAmount = 0;
    let resolvedChangeAmount = 0;
    let resolvedStatus = paymentStatus;
    let depositResult = null;

    if (isOutstanding) {
      resolvedStatus = 'Outstanding';
      resolvedPaidAmount = 0;
      resolvedChangeAmount = 0;
    } else if (isLunas) {
      depositResult = await applyDepositOnPayment(connection, {
        customerId: resolvedCustomerId,
        orderNo,
        grandTotal: grandTotalNum,
        paymentMethod,
        paidAmount,
        overpaymentToDeposit: Boolean(overpaymentToDeposit),
        outletId: outletId || 2,
        cashierEmployeeId: cashierEmployeeId || 167
      });
      resolvedPaidAmount = depositResult.paidAmount;
      resolvedChangeAmount = depositResult.changeAmount;
      resolvedStatus = 'Lunas';
    } else if (isDP) {
      resolvedPaidAmount = parseFloat(paidAmount) || 0;
      if (resolvedPaidAmount <= 0 || resolvedPaidAmount >= grandTotalNum) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Nominal DP harus lebih dari 0 dan kurang dari total tagihan'
        });
      }
      resolvedStatus = 'DP';
    }

    let resolvedParfumeId = parfumeId || null;
    if (!resolvedParfumeId && parfumeName) {
      const [parfumeRows] = await connection.query(
        'SELECT id FROM mst_parfume WHERE name = ? AND is_active = 1 LIMIT 1',
        [parfumeName]
      );
      resolvedParfumeId = parfumeRows[0]?.id || null;
    }

    // 1. Insert tr_transaction
    const [orderResult] = await connection.query(
      `INSERT INTO tr_transaction 
       (order_no, customer_id, outlet_id, cashier_employee_id, shift_id, order_category, total_weight_kg, total_pcs, speed_id, parfume_id, subtotal, speed_surcharge, discount_amount, discount_notes, grand_total, payment_status, payment_method, paid_amount, change_amount, payment_proof_url, paid_at, work_status, is_delivery, delivery_address, delivery_notes, special_notes, order_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?, ?, ?, ?, NOW())`,
      [
        orderNo,
        resolvedCustomerId,
        outletId || 2,
        cashierEmployeeId || 167,
        shiftId || null,
        orderCategory || 'Kiloan',
        parseFloat(totalWeightKg) || 0,
        parseInt(totalPcs) || 0,
        speedId || null,
        resolvedParfumeId,
        parseFloat(subtotal) || 0,
        parseFloat(speedSurcharge) || 0,
        parseFloat(discountAmount) || 0,
        discountNotes || null,
        grandTotalNum,
        resolvedStatus,
        isOutstanding ? '-' : (paymentMethod || 'Tunai'),
        resolvedPaidAmount,
        resolvedChangeAmount,
        paymentProofUrl || null,
        isOutstanding ? null : new Date(),
        isDelivery ? 1 : 0,
        deliveryAddress || null,
        deliveryNotes || null,
        specialNotes || null
      ]
    );

    const transactionId = orderResult.insertId;

    // 2. Insert tr_transaction_detail
    for (const item of items) {
      await connection.query(
        `INSERT INTO tr_transaction_detail 
         (transaction_id, service_id, service_name, qty, unit, unit_price, subtotal, is_cleanox, brand, color, material, size, condition_notes, item_work_status, photo_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          item.serviceId || item.serviceDbId || item.id || 1,
          item.serviceName || item.name || 'Layanan Laundry',
          parseFloat(item.qty) || 1,
          item.unit || 'Kg',
          parseFloat(item.unitPrice || item.price) || 0,
          parseFloat(item.subtotal || item.effectiveSubtotal || ((item.qty || 1) * (item.price || 0))) || 0,
          item.isCleanox ? 1 : 0,
          item.brand || null,
          item.color || null,
          item.material || null,
          item.size || null,
          item.conditionNotes || null,
          'Antrean',
          item.photoUrl || null
        ]
      );
    }

    // 3. Insert initial status log
    await connection.query(
      `INSERT INTO tr_transaction_status_log 
       (transaction_id, status, employee_id, notes)
       VALUES (?, 'Antrean', ?, 'Cetak Nota Diterima oleh Kasir')`,
      [transactionId, cashierEmployeeId || 167]
    );

    if (!isOutstanding) {
      await insertPaymentLog(connection, {
        transactionId,
        logType: resolvedStatus === 'Lunas' ? 'Lunas' : 'DP',
        amount: resolvedPaidAmount,
        paymentMethod: paymentMethod || 'Tunai',
        paymentProofUrl: paymentProofUrl || null,
        notes: resolvedStatus === 'DP' ? `DP nota ${orderNo}` : `Pembayaran lunas nota ${orderNo}`,
        cashierEmployeeId: cashierEmployeeId || 167
      });
    } else {
      await insertPaymentLog(connection, {
        transactionId,
        logType: 'Outstanding',
        amount: 0,
        paymentMethod: null,
        paymentProofUrl: null,
        notes: `Nota outstanding — pelanggan taruh cucian & pergi (${orderNo})`,
        cashierEmployeeId: cashierEmployeeId || 167
      });
    }

    // 4. Update customer spending summary & auto tier
    await applyTransactionSpendingUpdate(connection, resolvedCustomerId, grandTotalNum);

    await connection.commit();

    if (depositResult?.depositDelta) {
      emitDashboardRefresh('customer:updated', {
        outletId: outletId || 2,
        customerId: resolvedCustomerId
      });
    }

    // Fetch full created order with items
    const [fullOrder] = await myWaschenPool.query(
      `SELECT t.*,
              t.customer_id,
              c.customer_code,
              c.name as customer_name,
              c.phone as customer_phone,
              ct.name as customer_tier,
              COALESCE(NULLIF(TRIM(c.full_address), ''), NULLIF(TRIM(c.address), ''), '-') as customer_address,
              c.home_branch,
              COALESCE(o.full_name, o.name, c.home_branch, 'Outlet Waschen') as outlet_name
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       LEFT JOIN mst_customer_tier ct ON c.spending_tier_id = ct.id
       LEFT JOIN mst_outlet o ON o.id = t.outlet_id
       WHERE t.id = ?`,
      [transactionId]
    );

    const [orderItems] = await myWaschenPool.query(
      'SELECT * FROM tr_transaction_detail WHERE transaction_id = ?',
      [transactionId]
    );

    const resultData = fullOrder[0];
    resultData.items = orderItems;

    emitDashboardRefresh('transaction:created', {
      outletId: resultData.outlet_id,
      orderNo: orderNo,
      transactionId
    });

    return res.status(201).json({
      success: true,
      message: `Nota ${orderNo} berhasil disimpan & siap cetak struk POS`,
      data: {
        ...resultData,
        deposit_delta: depositResult?.depositDelta || 0,
        balance_after: depositResult?.balanceAfter ?? null
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating POS transaction:', error);
    const isClientError = /tidak cukup|kurang dari|tidak ditemukan/i.test(error.message || '');
    return res.status(isClientError ? 400 : 500).json({
      success: false,
      message: error.message || 'Gagal memproses transaksi nota',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/transactions
 * Mengambil daftar transaksi nota untuk Dashboard Antrean & Riwayat Transaksi
 */
export const getTransactions = async (req, res) => {
  try {
    const { outlet_id, work_status, payment_status, category, search, limit } = req.query;

    let sql = `
      SELECT t.*, 
             t.customer_id,
             c.customer_code,
             c.name as customer_name, 
             c.phone as customer_phone, 
             ct.name as customer_tier,
             COALESCE(NULLIF(TRIM(c.full_address), ''), NULLIF(TRIM(c.address), ''), '-') as customer_address,
             c.home_branch,
             COALESCE(o.full_name, o.name, c.home_branch, 'Outlet Waschen') as outlet_name,
             sp.name as speed_name,
             p.name as parfume_name,
             COALESCE(e.full_name, CONCAT('Kasir #', t.cashier_employee_id)) as cashier_name,
             (
               SELECT b.batch_no
               FROM tr_payment_batch_item bi
               JOIN tr_payment_batch b ON b.id = bi.batch_id
               WHERE bi.transaction_id = t.id
               ORDER BY bi.id DESC
               LIMIT 1
             ) as payment_batch_no,
             (
               SELECT b.id
               FROM tr_payment_batch_item bi
               JOIN tr_payment_batch b ON b.id = bi.batch_id
               WHERE bi.transaction_id = t.id
               ORDER BY bi.id DESC
               LIMIT 1
             ) as payment_batch_id
      FROM tr_transaction t
      LEFT JOIN mst_customer c ON c.id = t.customer_id
      LEFT JOIN mst_customer_tier ct ON c.spending_tier_id = ct.id
      LEFT JOIN mst_outlet o ON o.id = t.outlet_id
      LEFT JOIN mst_service_speed sp ON t.speed_id = sp.id
      LEFT JOIN mst_parfume p ON t.parfume_id = p.id
      LEFT JOIN waschen.mst_employee e ON t.cashier_employee_id = e.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (outlet_id && outlet_id !== 'Semua') {
      sql += ' AND t.outlet_id = ?';
      params.push(outlet_id);
    }

    if (work_status && work_status !== 'Semua') {
      const clause = workStatusTabSql(work_status, 't.work_status');
      sql += ` AND ${clause.sql}`;
      params.push(...clause.params);
    }

    if (req.query.customer_id) {
      sql += ' AND t.customer_id = ?';
      params.push(req.query.customer_id);
    }

    if (payment_status && payment_status !== 'Semua') {
      sql += ' AND t.payment_status = ?';
      params.push(payment_status);
    }

    if (category && category !== 'Semua') {
      sql += ' AND t.order_category = ?';
      params.push(category);
    }

    if (search && search.trim()) {
      sql += ' AND (t.order_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR sp.name LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY t.id DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    const [rows] = await myWaschenPool.query(sql, params);

    // Attach items & logs count
    const enriched = await Promise.all(rows.map(async (order) => {
      const [logs] = await myWaschenPool.query(
        'SELECT notes, status, created_at FROM tr_transaction_status_log WHERE transaction_id = ? ORDER BY id ASC',
        [order.id]
      );
      const [items] = await myWaschenPool.query(
        'SELECT * FROM tr_transaction_detail WHERE transaction_id = ?',
        [order.id]
      );
      return {
        ...order,
        items,
        logs: logs.map(l => l.notes || l.status),
        createdAtFormatted: new Date(order.order_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
    }));

    return res.status(200).json({
      success: true,
      data: enriched
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data transaksi',
      error: error.message
    });
  }
};

/**
 * GET /api/transactions/:orderNo
 * Ambil rincian nota by ID / orderNo untuk Lacak Nota & Thermal Receipt Modal
 */
export const getTransactionDetail = async (req, res) => {
  try {
    const { orderNo } = req.params;
    const key = String(orderNo || '').trim();

    const [orderRows] = await myWaschenPool.query(
      `SELECT t.*,
              t.customer_id,
              c.customer_code,
              c.name as customer_name,
              c.phone as customer_phone,
              ct.name as customer_tier,
              COALESCE(NULLIF(TRIM(c.full_address), ''), NULLIF(TRIM(c.address), ''), '-') as customer_address,
              c.home_branch,
              COALESCE(o.full_name, o.name, c.home_branch, 'Outlet Waschen') as outlet_name,
              sp.name as speed_name,
              p.name as parfume_name,
              COALESCE(e.full_name, CONCAT('Kasir #', t.cashier_employee_id)) as cashier_name,
              (
                SELECT b.batch_no
                FROM tr_payment_batch_item bi
                JOIN tr_payment_batch b ON b.id = bi.batch_id
                WHERE bi.transaction_id = t.id
                ORDER BY bi.id DESC
                LIMIT 1
              ) as payment_batch_no,
              (
                SELECT b.id
                FROM tr_payment_batch_item bi
                JOIN tr_payment_batch b ON b.id = bi.batch_id
                WHERE bi.transaction_id = t.id
                ORDER BY bi.id DESC
                LIMIT 1
              ) as payment_batch_id
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       LEFT JOIN mst_customer_tier ct ON c.spending_tier_id = ct.id
       LEFT JOIN mst_outlet o ON o.id = t.outlet_id
       LEFT JOIN mst_service_speed sp ON t.speed_id = sp.id
       LEFT JOIN mst_parfume p ON t.parfume_id = p.id
       LEFT JOIN waschen.mst_employee e ON t.cashier_employee_id = e.employee_id
       WHERE t.order_no = ? OR t.id = ?
       ORDER BY CASE WHEN t.order_no = ? THEN 0 ELSE 1 END, t.id DESC
       LIMIT 1`,
      [key, key, key]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Nota ${orderNo} tidak ditemukan`
      });
    }

    const order = orderRows[0];

    const [items] = await myWaschenPool.query(
      'SELECT * FROM tr_transaction_detail WHERE transaction_id = ?',
      [order.id]
    );

    const [logs] = await myWaschenPool.query(
      'SELECT * FROM tr_transaction_status_log WHERE transaction_id = ? ORDER BY id ASC',
      [order.id]
    );

    order.items = items;
    order.logs = logs;

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching transaction detail:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil detail nota',
      error: error.message
    });
  }
};

/**
 * PATCH /api/transactions/:id/status
 * Memajukan tahapan status pengerjaan (Antrean -> Pencucian -> Penyetrikaan -> Pengemasan -> Siap Diambil/Diantar -> Selesai)
 * Juga menyelaraskan semua item ke status yang sama (opsional jika syncItems !== false).
 */
export const updateWorkStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, workStatus, employeeId, notes, syncItems = true } = req.body;

    const [orderRows] = await myWaschenPool.query('SELECT * FROM tr_transaction WHERE id = ?', [id]);
    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    let nextStatus = status || workStatus;

    if (!nextStatus) {
      nextStatus = nextLifecycleStatus(order.work_status, order.is_delivery === 1);
    }

    if (syncItems !== false) {
      await myWaschenPool.query(
        'UPDATE tr_transaction_detail SET item_work_status = ? WHERE transaction_id = ?',
        [nextStatus, id]
      );
    }

    const accumulated = await refreshHeaderWorkPercentage(myWaschenPool, id);

    const logNote = notes || `Status pengerjaan item diseragamkan ke ${nextStatus} (rata-rata nota: ${accumulated}%)`;
    await myWaschenPool.query(
      'INSERT INTO tr_transaction_status_log (transaction_id, status, employee_id, notes) VALUES (?, ?, ?, ?)',
      [id, nextStatus, employeeId || 167, logNote]
    );

    emitDashboardRefresh('transaction:updated', {
      outletId: order.outlet_id,
      orderNo: order.order_no,
      transactionId: Number(id),
      workStatus: accumulated
    });

    return res.status(200).json({
      success: true,
      message: `Status nota ${order.order_no} berhasil diupdate (rata-rata ${accumulated}%)`,
      data: {
        orderId: id,
        orderNo: order.order_no,
        workStatus: accumulated
      }
    });
  } catch (error) {
    console.error('Error updating work status:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui status pengerjaan',
      error: error.message
    });
  }
};

/**
 * PATCH /api/transactions/:id/items/:itemId/status
 * Update status pengerjaan per item; akumulasi nota dihitung ulang dari semua item.
 */
export const updateItemWorkStatus = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { status, workStatus, employeeId, notes } = req.body;
    const nextStatus = status || workStatus;

    if (!nextStatus) {
      return res.status(400).json({ success: false, message: 'Status pengerjaan wajib diisi' });
    }

    const [orderRows] = await myWaschenPool.query(
      'SELECT * FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1',
      [id, id]
    );
    if (!orderRows.length) {
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }
    const order = orderRows[0];

    const [itemRows] = await myWaschenPool.query(
      'SELECT * FROM tr_transaction_detail WHERE id = ? AND transaction_id = ? LIMIT 1',
      [itemId, order.id]
    );
    if (!itemRows.length) {
      return res.status(404).json({ success: false, message: 'Item cucian tidak ditemukan pada nota ini' });
    }
    const item = itemRows[0];

    await myWaschenPool.query(
      'UPDATE tr_transaction_detail SET item_work_status = ? WHERE id = ?',
      [nextStatus, item.id]
    );

    const [allItems] = await myWaschenPool.query(
      'SELECT id, item_work_status FROM tr_transaction_detail WHERE transaction_id = ?',
      [order.id]
    );
    const accumulated = computeAccumulatedWorkPercentage(
      allItems.map((i) => (i.id === item.id ? nextStatus : (i.item_work_status || 'Antrean')))
    );

    await myWaschenPool.query(
      'UPDATE tr_transaction SET work_status = ?, updated_at = NOW() WHERE id = ?',
      [accumulated, order.id]
    );

    const logNote = notes
      || `Item "${item.service_name}" → ${nextStatus} (rata-rata nota: ${accumulated}%)`;
    await myWaschenPool.query(
      'INSERT INTO tr_transaction_status_log (transaction_id, status, employee_id, notes) VALUES (?, ?, ?, ?)',
      [order.id, nextStatus, employeeId || 167, logNote]
    );

    emitDashboardRefresh('transaction:updated', {
      outletId: order.outlet_id,
      orderNo: order.order_no,
      transactionId: order.id,
      workStatus: accumulated,
      itemId: Number(itemId),
      itemWorkStatus: nextStatus
    });

    return res.status(200).json({
      success: true,
      message: `Status item diperbarui ke ${nextStatus}`,
      data: {
        orderId: order.id,
        orderNo: order.order_no,
        itemId: Number(itemId),
        itemWorkStatus: nextStatus,
        workStatus: accumulated,
        items: allItems.map((i) => ({
          id: i.id,
          itemWorkStatus: i.id === item.id ? nextStatus : (i.item_work_status || 'Antrean')
        }))
      }
    });
  } catch (error) {
    console.error('Error updating item work status:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui status item',
      error: error.message
    });
  }
};

/**
 * PATCH /api/transactions/:id/pay
 * Pelunasan pembayaran nota di kasir
 */
export const markTransactionAsPaid = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const { id } = req.params;
    const { paymentMethod, paidAmount, overpaymentToDeposit, cashierEmployeeId } = req.body;

    await connection.beginTransaction();

    const [orderRows] = await connection.query('SELECT * FROM tr_transaction WHERE id = ?', [id]);
    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    const method = paymentMethod || 'Tunai';
    const grandTotalNum = parseFloat(order.grand_total) || 0;

    const depositResult = await applyDepositOnPayment(connection, {
      customerId: order.customer_id,
      orderNo: order.order_no,
      grandTotal: grandTotalNum,
      paymentMethod: method,
      paidAmount,
      overpaymentToDeposit: Boolean(overpaymentToDeposit),
      outletId: order.outlet_id,
      cashierEmployeeId: cashierEmployeeId || order.cashier_employee_id
    });

    await connection.query(
      `UPDATE tr_transaction 
       SET payment_status = 'Lunas',
           payment_method = ?,
           paid_amount = ?,
           change_amount = ?,
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [method, depositResult.paidAmount, depositResult.changeAmount, id]
    );

    await connection.commit();

    emitDashboardRefresh('transaction:paid', {
      outletId: order.outlet_id,
      orderNo: order.order_no,
      transactionId: Number(id)
    });

    if (depositResult.depositDelta) {
      emitDashboardRefresh('customer:updated', {
        outletId: order.outlet_id,
        customerId: order.customer_id
      });
    }

    return res.status(200).json({
      success: true,
      message: `Nota ${order.order_no} telah lunas terbayar via ${method}`,
      data: {
        orderId: id,
        orderNo: order.order_no,
        paymentStatus: 'Lunas',
        paymentMethod: method,
        paidAmount: depositResult.paidAmount,
        changeAmount: depositResult.changeAmount,
        depositDelta: depositResult.depositDelta,
        balanceAfter: depositResult.balanceAfter
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error marking order as paid:', error);
    return res.status(error.message?.includes('tidak cukup') || error.message?.includes('kurang')
      ? 400
      : 500).json({
      success: false,
      message: error.message || 'Gagal melunasi pembayaran nota',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * PATCH /api/transactions/:id/request-delete
 * Pengajuan Hapus Nota oleh Kasir (Status = Pending / 0, Menunggu Approval = 1)
 */
export const requestDeleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [orderRows] = await myWaschenPool.query('SELECT * FROM tr_transaction WHERE id = ? OR order_no = ?', [id, id]);
    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    await myWaschenPool.query(
      `UPDATE tr_transaction 
       SET is_delete_requested = 1,
           delete_approval_status = 0,
           delete_requested_at = NOW(),
           delete_reason = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [reason || 'Request Hapus Nota oleh Kasir', order.id]
    );

    emitDashboardRefresh('transaction:updated', {
      outletId: order.outlet_id,
      orderNo: order.order_no,
      transactionId: order.id
    });

    return res.status(200).json({
      success: true,
      message: `Pengajuan hapus nota ${order.order_no} berhasil dikirim (Status: Pending Approval / 0)`,
      data: {
        orderId: order.id,
        orderNo: order.order_no,
        isDeleteRequested: 1,
        deleteApprovalStatus: 0
      }
    });
  } catch (error) {
    console.error('Error requesting transaction deletion:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengajukan hapus nota',
      error: error.message
    });
  }
};

/**
 * POST /api/transactions/settle-batch
 * Pelunasan gabungan multi-nota sekaligus (1 kali bayar / 1 foto bukti transfer)
 */
export const settlePaymentBatch = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const {
      customerId,
      outletId,
      cashierEmployeeId,
      shiftId,
      paymentMethod,
      paymentProofUrl,
      items = [],
      notes,
      paidAmount: rawPaidAmount,
      overpaymentToDeposit = false
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada nota yang dipilih untuk pelunasan.' });
    }

    const resolvedCustomerId = parseInt(customerId, 10) || null;
    if (!resolvedCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID tidak valid. Buka ulang detail pelanggan lalu coba lagi.'
      });
    }

    const [custRows] = await connection.query(
      'SELECT id, name, phone FROM mst_customer WHERE id = ? LIMIT 1',
      [resolvedCustomerId]
    );
    if (!custRows.length) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
    }
    const customerRow = custRows[0];

    // Pastikan semua nota milik pelanggan yang sama
    for (const item of items) {
      const txnId = parseInt(item.transactionId, 10);
      if (!txnId) {
        return res.status(400).json({ success: false, message: 'ID transaksi tidak valid pada daftar nota' });
      }
      const [ownRows] = await connection.query(
        'SELECT id, order_no, customer_id FROM tr_transaction WHERE id = ? LIMIT 1',
        [txnId]
      );
      if (!ownRows.length) {
        return res.status(404).json({ success: false, message: `Nota ID ${txnId} tidak ditemukan` });
      }
      if (Number(ownRows[0].customer_id) !== resolvedCustomerId) {
        return res.status(400).json({
          success: false,
          message: `Nota ${ownRows[0].order_no} bukan milik pelanggan yang dipilih`
        });
      }
    }

    await connection.beginTransaction();

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const [countRows] = await connection.query(
      "SELECT COUNT(*) AS total FROM tr_payment_batch WHERE DATE(created_at) = CURDATE()"
    );
    const seq = (parseInt(countRows[0]?.total || 0) + 1).toString().padStart(3, '0');
    const batchNo = `COMB-${datePrefix}${seq}`;

    const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amountToPay) || 0), 0);
    const paidAmount = parseFloat(rawPaidAmount) || totalAmount;
    const excess = Math.max(0, paidAmount - totalAmount);

    let depositAdded = 0;
    let changeAmount = excess;

    if (excess > 0 && overpaymentToDeposit && resolvedCustomerId) {
      const depositRes = await applyDepositOnPayment(connection, {
        customerId: resolvedCustomerId,
        outletId,
        cashierEmployeeId,
        overpaymentAmount: excess,
        paymentMethod: paymentMethod || 'Tunai',
        notes: `Kelebihan pelunasan gabungan batch #${batchNo}`
      });
      if (depositRes?.depositAdded) {
        depositAdded = excess;
        changeAmount = 0;
      }
    }

    const [batchResult] = await connection.query(
      `INSERT INTO tr_payment_batch 
       (batch_no, customer_id, outlet_id, cashier_employee_id, shift_id, total_amount, payment_method, payment_proof_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchNo,
        resolvedCustomerId,
        outletId || 0,
        cashierEmployeeId || 0,
        shiftId || null,
        totalAmount,
        paymentMethod || 'Tunai',
        paymentProofUrl || null,
        notes || `Pelunasan gabungan ${items.length} nota`
      ]
    );
    const batchId = batchResult.insertId;

    const settledTransactions = [];

    for (const item of items) {
      const [orderRows] = await connection.query(
        'SELECT * FROM tr_transaction WHERE id = ? FOR UPDATE',
        [item.transactionId]
      );
      if (orderRows.length === 0) continue;

      const order = orderRows[0];
      const grandTotal = parseFloat(order.grand_total) || 0;
      const currentPaid = parseFloat(order.paid_amount) || 0;
      const amountToPay = parseFloat(item.amountToPay) || (grandTotal - currentPaid);
      const newPaidAmount = Math.min(grandTotal, currentPaid + amountToPay);
      const newStatus = newPaidAmount >= grandTotal ? 'Lunas' : 'DP';

      await connection.query(
        `UPDATE tr_transaction 
         SET paid_amount = ?,
             payment_status = ?,
             payment_method = ?,
             payment_proof_url = COALESCE(?, payment_proof_url),
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [newPaidAmount, newStatus, paymentMethod, paymentProofUrl, order.id]
      );

      await connection.query(
        `INSERT INTO tr_payment_log 
         (transaction_id, payment_batch_id, log_type, amount, payment_method, payment_proof_url, notes, cashier_employee_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          batchId,
          newStatus,
          amountToPay,
          paymentMethod,
          paymentProofUrl,
          `Pelunasan gabungan #${batchNo}`,
          cashierEmployeeId
        ]
      );

      await connection.query(
        `INSERT INTO tr_payment_batch_item (batch_id, transaction_id, allocated_amount) VALUES (?, ?, ?)`,
        [batchId, order.id, amountToPay]
      );

      settledTransactions.push({
        id: order.id,
        orderNo: order.order_no,
        orderCategory: order.order_category,
        grandTotal: grandTotal,
        amountPaidThisBatch: amountToPay,
        paymentStatus: newStatus
      });
    }

    await connection.commit();

    emitDashboardRefresh('transaction:updated', {
      outletId,
      batchNo,
      settledCount: settledTransactions.length
    });

    return res.status(200).json({
      success: true,
      message: `Berhasil memproses pelunasan gabungan (${settledTransactions.length} nota) dengan No. Batch ${batchNo}`,
      data: {
        batchId,
        batchNo,
        customerId: resolvedCustomerId,
        customer_name: customerRow.name,
        customer_phone: customerRow.phone,
        customerName: customerRow.name,
        customerPhone: customerRow.phone,
        totalAmount,
        paidAmount,
        changeAmount,
        depositAdded,
        paymentMethod,
        paymentProofUrl,
        settledTransactions
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error settling batch payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses pelunasan gabungan nota',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/transactions/batch/:batchNo
 * Detail batch pelunasan gabungan untuk cetak nota & audit
 */
export const getPaymentBatchByNo = async (req, res) => {
  try {
    const { batchNo } = req.params;
    const [batchRows] = await myWaschenPool.query(
      `SELECT b.*, 
              c.name as customer_name, 
              c.phone as customer_phone, 
              o.full_name as outlet_name,
              COALESCE(e.full_name, CONCAT('Kasir #', b.cashier_employee_id)) as cashier_name
       FROM tr_payment_batch b
       LEFT JOIN mst_customer c ON c.id = b.customer_id
       LEFT JOIN mst_outlet o ON o.id = b.outlet_id
       LEFT JOIN waschen.mst_employee e ON e.employee_id = b.cashier_employee_id
       WHERE b.batch_no = ? OR b.id = ?`,
      [batchNo, batchNo]
    );

    if (batchRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Batch pelunasan tidak ditemukan' });
    }

    const batch = batchRows[0];

    const [items] = await myWaschenPool.query(
      `SELECT bi.*, t.order_no, t.order_category, t.grand_total, t.total_weight_kg, t.total_pcs
       FROM tr_payment_batch_item bi
       JOIN tr_transaction t ON t.id = bi.transaction_id
       WHERE bi.batch_id = ?`,
      [batch.id]
    );

    const formattedItems = items.map((it) => ({
      ...it,
      orderNo: it.order_no,
      orderCategory: it.order_category,
      amountPaidThisBatch: parseFloat(it.allocated_amount) || parseFloat(it.grand_total) || 0
    }));

    return res.status(200).json({
      success: true,
      data: {
        ...batch,
        batchId: batch.id,
        batchNo: batch.batch_no,
        totalAmount: parseFloat(batch.total_amount) || 0,
        paidAmount: parseFloat(batch.total_amount) || 0,
        paymentMethod: batch.payment_method,
        paymentProofUrl: batch.payment_proof_url,
        settledTransactions: formattedItems,
        items: formattedItems
      }
    });
  } catch (error) {
    console.error('Error fetching payment batch:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data batch pelunasan',
      error: error.message
    });
  }
};

