import { myWaschenPool } from '../db/pool.js';

/**
 * Helper to generate order number: WS-MMYYXXX (e.g. WS-0826001)
 */
const generateOrderNo = async () => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const prefix = `WS-${mm}${yy}`;

  const [rows] = await myWaschenPool.query(
    'SELECT order_no FROM tr_transaction WHERE order_no LIKE ? ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );

  let seq = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].order_no;
    const lastSeq = parseInt(lastNo.replace(prefix, '')) || 0;
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
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

    const orderNo = await generateOrderNo();
    const isPaid = paymentStatus === 'Lunas';

    // 1. Insert tr_transaction
    const [orderResult] = await connection.query(
      `INSERT INTO tr_transaction 
       (order_no, customer_id, outlet_id, cashier_employee_id, order_category, total_weight_kg, total_pcs, speed_id, parfume_id, subtotal, speed_surcharge, discount_amount, discount_notes, grand_total, payment_status, payment_method, paid_amount, change_amount, paid_at, work_status, is_delivery, delivery_address, delivery_notes, special_notes, order_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Antrean', ?, ?, ?, ?, NOW())`,
      [
        orderNo,
        customerId,
        outletId || 2,
        cashierEmployeeId || 167,
        orderCategory || 'Kiloan',
        parseFloat(totalWeightKg) || 0,
        parseInt(totalPcs) || 0,
        speedId || null,
        parfumeId || null,
        parseFloat(subtotal) || 0,
        parseFloat(speedSurcharge) || 0,
        parseFloat(discountAmount) || 0,
        discountNotes || null,
        parseFloat(grandTotal) || 0,
        isPaid ? 'Lunas' : 'Belum Lunas',
        paymentMethod || (isPaid ? 'Tunai' : '-'),
        parseFloat(paidAmount) || (isPaid ? parseFloat(grandTotal) : 0),
        parseFloat(changeAmount) || 0,
        isPaid ? new Date() : null,
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
         (transaction_id, service_id, service_name, qty, unit, unit_price, subtotal, brand, color, material, size, condition_notes, photo_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          item.serviceId || item.id || 1,
          item.serviceName || item.name || 'Layanan Laundry',
          parseFloat(item.qty) || 1,
          item.unit || 'Kg',
          parseFloat(item.unitPrice || item.price) || 0,
          parseFloat(item.subtotal || ((item.qty || 1) * (item.price || 0))) || 0,
          item.brand || null,
          item.color || null,
          item.material || null,
          item.size || null,
          item.conditionNotes || null,
          item.photoUrl || null
        ]
      );
    }

    // 3. Insert initial status log in tr_transaction_status_log
    await connection.query(
      `INSERT INTO tr_transaction_status_log 
       (transaction_id, status, employee_id, notes)
       VALUES (?, 'Antrean', ?, 'Cetak Nota Diterima oleh Kasir')`,
      [transactionId, cashierEmployeeId || 167]
    );

    // 4. Update Customer summary
    await connection.query(
      `UPDATE mst_customer 
       SET total_orders = total_orders + 1,
           total_spent = total_spent + ?,
           updated_at = NOW()
       WHERE id = ?`,
      [parseFloat(grandTotal) || 0, customerId]
    );

    await connection.commit();

    // Fetch full created order with items
    const [fullOrder] = await myWaschenPool.query(
      `SELECT t.*, c.name as customer_name, c.phone as customer_phone, c.tier as customer_tier 
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON t.customer_id = c.id
       WHERE t.id = ?`,
      [transactionId]
    );

    const [orderItems] = await myWaschenPool.query(
      'SELECT * FROM tr_transaction_detail WHERE transaction_id = ?',
      [transactionId]
    );

    const resultData = fullOrder[0];
    resultData.items = orderItems;

    return res.status(201).json({
      success: true,
      message: `Nota ${orderNo} berhasil disimpan & siap cetak struk POS`,
      data: resultData
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating POS transaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memproses transaksi nota',
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
             c.name as customer_name, 
             c.phone as customer_phone, 
             c.tier as customer_tier,
             c.home_branch,
             sp.name as speed_name,
             p.name as parfume_name
      FROM tr_transaction t
      LEFT JOIN mst_customer c ON t.customer_id = c.id
      LEFT JOIN mst_service_speed sp ON t.speed_id = sp.id
      LEFT JOIN mst_parfume p ON t.parfume_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (outlet_id && outlet_id !== 'Semua') {
      sql += ' AND t.outlet_id = ?';
      params.push(outlet_id);
    }

    if (work_status && work_status !== 'Semua') {
      if (work_status === 'Proses') {
        sql += " AND t.work_status IN ('Pencucian', 'Penyetrikaan', 'Pengemasan')";
      } else if (work_status === 'Siap Diambil / Diantar') {
        sql += " AND t.work_status IN ('Siap Diambil', 'Siap Diantar')";
      } else {
        sql += ' AND t.work_status = ?';
        params.push(work_status);
      }
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

    const [orderRows] = await myWaschenPool.query(
      `SELECT t.*, 
              c.name as customer_name, 
              c.phone as customer_phone, 
              c.tier as customer_tier,
              c.address as customer_address
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON t.customer_id = c.id
       WHERE t.id = ? OR t.order_no = ?
       LIMIT 1`,
      [orderNo, orderNo]
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
 */
export const updateWorkStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, employeeId, notes } = req.body;

    const [orderRows] = await myWaschenPool.query('SELECT * FROM tr_transaction WHERE id = ?', [id]);
    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    let nextStatus = status;

    // Auto-advance if status not specified
    if (!nextStatus) {
      const isDelivery = order.is_delivery === 1;
      const lifecycle = [
        'Antrean',
        'Pencucian',
        'Penyetrikaan',
        'Pengemasan',
        isDelivery ? 'Siap Diantar' : 'Siap Diambil',
        'Selesai'
      ];
      const curIdx = lifecycle.indexOf(order.work_status);
      nextStatus = curIdx !== -1 && curIdx < lifecycle.length - 1 ? lifecycle[curIdx + 1] : 'Antrean';
    }

    await myWaschenPool.query(
      'UPDATE tr_transaction SET work_status = ?, updated_at = NOW() WHERE id = ?',
      [nextStatus, id]
    );

    // Insert log
    const logNote = notes || `Status pengerjaan diubah ke ${nextStatus}`;
    await myWaschenPool.query(
      'INSERT INTO tr_transaction_status_log (transaction_id, status, employee_id, notes) VALUES (?, ?, ?, ?)',
      [id, nextStatus, employeeId || 167, logNote]
    );

    return res.status(200).json({
      success: true,
      message: `Status nota ${order.order_no} berhasil diupdate ke: ${nextStatus}`,
      data: {
        orderId: id,
        orderNo: order.order_no,
        workStatus: nextStatus
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
 * PATCH /api/transactions/:id/pay
 * Pelunasan pembayaran nota di kasir
 */
export const markTransactionAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, paidAmount } = req.body;

    const [orderRows] = await myWaschenPool.query('SELECT * FROM tr_transaction WHERE id = ?', [id]);
    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    const method = paymentMethod || 'Tunai';
    const amount = paidAmount || order.grand_total;

    await myWaschenPool.query(
      `UPDATE tr_transaction 
       SET payment_status = 'Lunas',
           payment_method = ?,
           paid_amount = ?,
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [method, amount, id]
    );

    return res.status(200).json({
      success: true,
      message: `Nota ${order.order_no} telah lunas terbayar via ${method}`,
      data: {
        orderId: id,
        orderNo: order.order_no,
        paymentStatus: 'Lunas',
        paymentMethod: method
      }
    });
  } catch (error) {
    console.error('Error marking order as paid:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal melunasi pembayaran nota',
      error: error.message
    });
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
