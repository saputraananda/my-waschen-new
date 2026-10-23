import path from 'path';
import { getEmployeeNames, fillFallbackNames } from '../utils/employeeName.js';
import { myWaschenPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import { applyDepositOnPayment } from '../utils/customerDeposit.js';
import {
  insertPaymentLog,
  buildPaymentProofUrl
} from '../utils/paymentLog.js';
import { uploadPaymentReceipt, replaceUploadUrl, safeUnlinkAbsPath, safeUnlinkUploadUrl } from '../middleware/upload.js';

export const uploadPaymentProofMiddleware = uploadPaymentReceipt;

/**
 * GET /api/history/transactions/:id/payments
 */
export const getPaymentLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const [orderRows] = await myWaschenPool.query(
      `SELECT t.id, t.order_no, t.grand_total, t.paid_amount, t.payment_status, t.payment_method,
              t.payment_proof_url, t.customer_id, t.cashier_employee_id,
              t.paid_at, t.settled_by_employee_id, t.settled_at,
              COALESCE(c.deposit_balance, 0) AS member_balance,
              COALESCE(c.deposit_balance, 0) AS customer_deposit_balance
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       WHERE t.id = ? OR t.order_no = ?
       LIMIT 1`,
      [id, id]
    );
    if (!orderRows.length) {
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }
    const order = orderRows[0];
    const [logs] = await myWaschenPool.query(
      `SELECT pl.*,
              COALESCE(NULLIF(TRIM(r.employee_name), ''), CONCAT('Karyawan #', pl.cashier_employee_id)) AS cashier_name
       FROM tr_payment_log pl
       LEFT JOIN mst_role r ON r.employee_id = pl.cashier_employee_id
       WHERE pl.transaction_id = ?
       ORDER BY pl.id ASC`,
      [order.id]
    );

    await fillFallbackNames(logs, 'cashier_employee_id', 'cashier_name');

    let settledByName = null;
    if (order.settled_by_employee_id) {
      const [settlerRows] = await myWaschenPool.query(
        `SELECT COALESCE(NULLIF(TRIM(employee_name), ''), CONCAT('Karyawan #', employee_id)) AS name
         FROM mst_role WHERE employee_id = ? LIMIT 1`,
        [order.settled_by_employee_id]
      );
      settledByName = settlerRows[0]?.name || (await getEmployeeNames([order.settled_by_employee_id])).get(Number(order.settled_by_employee_id)) || null;
    }

    const remaining = Math.max(0, parseFloat(order.grand_total) - parseFloat(order.paid_amount || 0));
    return res.status(200).json({
      success: true,
      data: {
        order: {
          ...order,
          settled_by_name: settledByName
        },
        logs,
        remaining,
        grandTotal: parseFloat(order.grand_total) || 0,
        paidAmount: parseFloat(order.paid_amount) || 0
      }
    });
  } catch (error) {
    console.error('Error getPaymentLogs:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat pembayaran', error: error.message });
  }
};

/**
 * POST /api/history/transactions/:id/payment-proof
 */
export const uploadPaymentProof = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File bukti pembayaran wajib diupload' });
    }

    const proofUrl = buildPaymentProofUrl(path.basename(req.file.filename || req.file.path));
    const [orderRows] = await myWaschenPool.query(
      'SELECT id, outlet_id, payment_proof_url FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1',
      [id, id]
    );
    if (!orderRows.length) {
      await safeUnlinkAbsPath(req.file.path);
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    await myWaschenPool.query(
      'UPDATE tr_transaction SET payment_proof_url = ?, updated_at = NOW() WHERE id = ?',
      [proofUrl, order.id]
    );

    await replaceUploadUrl(order.payment_proof_url, proofUrl);

    emitDashboardRefresh('transaction:updated', { outletId: order.outlet_id, transactionId: order.id });

    return res.status(200).json({
      success: true,
      message: 'Bukti pembayaran berhasil diupload',
      data: { paymentProofUrl: proofUrl }
    });
  } catch (error) {
    console.error('Error uploadPaymentProof:', error);
    if (req.file?.path) await safeUnlinkAbsPath(req.file.path);
    return res.status(500).json({ success: false, message: 'Gagal upload bukti pembayaran' });
  }
};

/**
 * DELETE /api/history/transactions/:id/payment-proof
 * Kosongkan URL di nota dan hapus file di server.
 */
export const deletePaymentProof = async (req, res) => {
  try {
    const { id } = req.params;
    const [orderRows] = await myWaschenPool.query(
      'SELECT id, outlet_id, payment_proof_url FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1',
      [id, id]
    );
    if (!orderRows.length) {
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    await myWaschenPool.query(
      'UPDATE tr_transaction SET payment_proof_url = NULL, updated_at = NOW() WHERE id = ?',
      [order.id]
    );
    if (order.payment_proof_url) await safeUnlinkUploadUrl(order.payment_proof_url);

    emitDashboardRefresh('transaction:updated', { outletId: order.outlet_id, transactionId: order.id });
    return res.status(200).json({ success: true, message: 'Bukti pembayaran dihapus' });
  } catch (error) {
    console.error('Error deletePaymentProof:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus bukti pembayaran' });
  }
};

/**
 * PATCH /api/history/transactions/:id/payment
 * Pelunasan nota DP / Outstanding. Nominal dikunci = sisa tagihan (Phase 13):
 * tidak ada kembalian, deposit, atau refund kelebihan bayar di sini.
 * `additionalAmount` dari client hanya dicek, harus sama dengan sisa tagihan.
 */
export const updateTransactionPayment = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const { id } = req.params;
    const {
      paymentMethod,
      additionalAmount,
      paymentProofUrl,
      notes,
      cashierEmployeeId
    } = req.body;

    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      'SELECT * FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1 FOR UPDATE',
      [id, id]
    );
    if (!orderRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    const [openShiftRows] = await connection.query(
      `SELECT id FROM tr_cashier_shift WHERE outlet_id = ? AND status = 'Open' ORDER BY id DESC LIMIT 1`,
      [order.outlet_id]
    );
    if (!openShiftRows.length && !Number(order.is_event)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: 'Pelunasan hanya bisa saat shift outlet sedang terbuka'
      });
    }

    const grandTotal = parseFloat(order.grand_total) || 0;
    const currentPaid = parseFloat(order.paid_amount) || 0;
    const remaining = Math.round(Math.max(0, grandTotal - currentPaid) * 100) / 100;
    if (remaining <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Nota ${order.order_no} sudah lunas` });
    }

    const requested = additionalAmount === undefined || additionalAmount === null
      ? remaining
      : Math.round((parseFloat(additionalAmount) || 0) * 100) / 100;
    if (Math.abs(requested - remaining) > 0.009) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Nominal pelunasan harus sama dengan sisa tagihan Rp ${remaining.toLocaleString('id-ID')}`
      });
    }

    const method = paymentMethod || order.payment_method || 'Tunai';
    const settlerId = cashierEmployeeId || order.cashier_employee_id || null;

    // Saldo Member: potong sisa tagihan dari saldo; metode lain tidak mengubah saldo.
    const depositResult = await applyDepositOnPayment(connection, {
      customerId: order.customer_id,
      orderNo: order.order_no,
      grandTotal: remaining,
      paymentMethod: method,
      outletId: order.outlet_id,
      cashierEmployeeId: settlerId
    });

    await insertPaymentLog(connection, {
      transactionId: order.id,
      logType: currentPaid <= 0 ? 'Lunas' : 'Pelunasan',
      amount: remaining,
      paymentMethod: method,
      paymentProofUrl: paymentProofUrl || null,
      notes: notes || `Pelunasan nota ${order.order_no}`,
      cashierEmployeeId: settlerId
    });

    const proofUrl = paymentProofUrl || order.payment_proof_url;

    await connection.query(
      `UPDATE tr_transaction SET
         payment_status = 'Lunas',
         payment_method = ?,
         paid_amount = ?,
         change_amount = 0,
         payment_proof_url = ?,
         paid_at = NOW(),
         settled_by_employee_id = ?,
         settled_at = NOW(),
         updated_at = NOW()
       WHERE id = ?`,
      [method, grandTotal, proofUrl, settlerId, order.id]
    );

    await connection.commit();

    emitDashboardRefresh('transaction:paid', {
      outletId: order.outlet_id,
      orderNo: order.order_no,
      transactionId: order.id
    });

    if (depositResult?.depositDelta) {
      emitDashboardRefresh('customer:updated', {
        outletId: order.outlet_id,
        customerId: order.customer_id
      });
    }

    // Hapus file bukti lama jika diganti URL baru
    if (proofUrl && order.payment_proof_url && proofUrl !== order.payment_proof_url) {
      await replaceUploadUrl(order.payment_proof_url, proofUrl);
    }

    return res.status(200).json({
      success: true,
      message: `Pembayaran nota ${order.order_no} diperbarui (Lunas)`,
      data: {
        transactionId: order.id,
        orderNo: order.order_no,
        paymentStatus: 'Lunas',
        paymentMethod: method,
        paidAmount: grandTotal,
        changeAmount: 0,
        remaining: 0,
        paymentProofUrl: proofUrl,
        depositDelta: depositResult?.depositDelta || 0
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error updateTransactionPayment:', error);
    const isClient = /tidak cukup|kurang|harus/i.test(error.message || '');
    return res.status(isClient ? 400 : 500).json({
      success: false,
      message: error.message || 'Gagal memperbarui pembayaran',
      error: error.message
    });
  } finally {
    connection.release();
  }
};
