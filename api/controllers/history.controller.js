import path from 'path';
import { myWaschenPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import { applyDepositOnPayment } from '../utils/customerDeposit.js';
import {
  insertPaymentLog,
  resolvePaymentStatus,
  buildPaymentProofUrl
} from '../utils/paymentLog.js';
import { uploadPaymentReceipt } from '../middleware/upload.js';

export const uploadPaymentProofMiddleware = uploadPaymentReceipt;

/**
 * GET /api/history/transactions/:id/payments
 */
export const getPaymentLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const [orderRows] = await myWaschenPool.query(
      `SELECT t.id, t.order_no, t.grand_total, t.paid_amount, t.payment_status, t.payment_method, t.payment_proof_url, t.customer_id,
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
      'SELECT * FROM tr_payment_log WHERE transaction_id = ? ORDER BY id ASC',
      [order.id]
    );
    const remaining = Math.max(0, parseFloat(order.grand_total) - parseFloat(order.paid_amount || 0));
    return res.status(200).json({
      success: true,
      data: {
        order,
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
      'SELECT id, outlet_id FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1',
      [id, id]
    );
    if (!orderRows.length) {
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    await myWaschenPool.query(
      'UPDATE tr_transaction SET payment_proof_url = ?, updated_at = NOW() WHERE id = ?',
      [proofUrl, order.id]
    );

    emitDashboardRefresh('transaction:updated', { outletId: order.outlet_id, transactionId: order.id });

    return res.status(200).json({
      success: true,
      message: 'Bukti pembayaran berhasil diupload',
      data: { paymentProofUrl: proofUrl }
    });
  } catch (error) {
    console.error('Error uploadPaymentProof:', error);
    return res.status(500).json({ success: false, message: 'Gagal upload bukti pembayaran', error: error.message });
  }
};

/**
 * PATCH /api/history/transactions/:id/payment
 */
export const updateTransactionPayment = async (req, res) => {
  const connection = await myWaschenPool.getConnection();
  try {
    const { id } = req.params;
    const {
      paymentStatus,
      paymentMethod,
      paidAmount,
      additionalAmount,
      overpaymentToDeposit,
      overpaymentToRefund,
      overpaymentAction,
      paymentProofUrl,
      notes,
      cashierEmployeeId
    } = req.body;

    const wantRefundOverpayment = Boolean(overpaymentToRefund)
      || String(overpaymentAction || '').toLowerCase() === 'refund';

    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      'SELECT * FROM tr_transaction WHERE id = ? OR order_no = ? LIMIT 1',
      [id, id]
    );
    if (!orderRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Nota tidak ditemukan' });
    }

    const order = orderRows[0];
    const grandTotal = parseFloat(order.grand_total) || 0;
    const currentPaid = parseFloat(order.paid_amount) || 0;
    let targetStatus = paymentStatus || order.payment_status;
    let newPaid = currentPaid;
    let changeAmount = parseFloat(order.change_amount) || 0;
    let depositResult = null;
    let refundAmountToSave = 0;

    if (targetStatus === 'Outstanding') {
      newPaid = 0;
      changeAmount = 0;
    } else if (additionalAmount !== undefined && additionalAmount !== null) {
      const add = parseFloat(additionalAmount) || 0;
      if (add <= 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Nominal tambahan bayar harus lebih dari 0' });
      }

      const totalPaidAttempt = currentPaid + add;
      targetStatus = resolvePaymentStatus(totalPaidAttempt, grandTotal);

      if (targetStatus === 'Lunas' && totalPaidAttempt > grandTotal) {
        const excess = Math.round((totalPaidAttempt - grandTotal) * 100) / 100;
        if (wantRefundOverpayment) {
          newPaid = totalPaidAttempt;
          changeAmount = 0;
          refundAmountToSave = excess;
        } else if (overpaymentToDeposit) {
          newPaid = grandTotal;
          changeAmount = 0;
          if (excess > 0) {
            depositResult = await applyDepositOnPayment(connection, {
              customerId: order.customer_id,
              orderNo: order.order_no,
              grandTotal: grandTotal + excess,
              paymentMethod: paymentMethod || order.payment_method,
              paidAmount: totalPaidAttempt,
              overpaymentToDeposit: true,
              outletId: order.outlet_id,
              cashierEmployeeId: cashierEmployeeId || order.cashier_employee_id
            });
          }
        } else {
          changeAmount = excess;
          newPaid = grandTotal;
        }
      } else {
        newPaid = Math.min(totalPaidAttempt, grandTotal);
      }

      await insertPaymentLog(connection, {
        transactionId: order.id,
        logType: currentPaid <= 0 ? (targetStatus === 'Lunas' ? 'Lunas' : 'DP') : 'Pelunasan',
        amount: add,
        paymentMethod: paymentMethod || order.payment_method,
        paymentProofUrl: paymentProofUrl || null,
        notes: notes || `Pelunasan nota ${order.order_no}`,
        cashierEmployeeId: cashierEmployeeId || order.cashier_employee_id
      });
    } else if (paidAmount !== undefined) {
      newPaid = parseFloat(paidAmount) || 0;
      targetStatus = resolvePaymentStatus(newPaid, grandTotal);

      if (targetStatus === 'Lunas') {
        depositResult = await applyDepositOnPayment(connection, {
          customerId: order.customer_id,
          orderNo: order.order_no,
          grandTotal,
          paymentMethod: paymentMethod || order.payment_method,
          paidAmount: newPaid,
          overpaymentToDeposit: Boolean(overpaymentToDeposit) && !wantRefundOverpayment,
          overpaymentToRefund: wantRefundOverpayment,
          outletId: order.outlet_id,
          cashierEmployeeId: cashierEmployeeId || order.cashier_employee_id
        });
        newPaid = depositResult.paidAmount;
        changeAmount = depositResult.changeAmount;
        refundAmountToSave = parseFloat(depositResult.refundAmount) || 0;
      } else if (targetStatus === 'DP') {
        if (newPaid <= 0 || newPaid >= grandTotal) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: 'Nominal DP harus lebih dari 0 dan kurang dari total tagihan' });
        }
      }

      await insertPaymentLog(connection, {
        transactionId: order.id,
        logType: targetStatus === 'Lunas' ? 'Lunas' : targetStatus === 'DP' ? 'DP' : 'Outstanding',
        amount: newPaid,
        paymentMethod: paymentMethod || order.payment_method,
        paymentProofUrl: paymentProofUrl || null,
        notes: notes || `Update pembayaran nota ${order.order_no}`,
        cashierEmployeeId: cashierEmployeeId || order.cashier_employee_id
      });
    }

    const method = targetStatus === 'Outstanding' ? '-' : (paymentMethod || order.payment_method || 'Tunai');
    const proofUrl = paymentProofUrl || order.payment_proof_url;

    await connection.query(
      `UPDATE tr_transaction SET
         payment_status = ?,
         payment_method = ?,
         paid_amount = ?,
         change_amount = ?,
         payment_proof_url = ?,
         paid_at = CASE WHEN ? = 'Lunas' THEN NOW() WHEN paid_at IS NULL AND ? > 0 THEN NOW() ELSE paid_at END,
         is_refund_requested = CASE WHEN ? > 0 THEN 1 ELSE is_refund_requested END,
         refund_approval_status = CASE WHEN ? > 0 THEN 0 ELSE refund_approval_status END,
         refund_requested_at = CASE WHEN ? > 0 THEN NOW() ELSE refund_requested_at END,
         refund_reason = CASE WHEN ? > 0 THEN ? ELSE refund_reason END,
         refund_amount = CASE WHEN ? > 0 THEN ? ELSE refund_amount END,
         updated_at = NOW()
       WHERE id = ?`,
      [
        targetStatus,
        method,
        newPaid,
        changeAmount,
        proofUrl,
        targetStatus,
        newPaid,
        refundAmountToSave,
        refundAmountToSave,
        refundAmountToSave,
        refundAmountToSave,
        refundAmountToSave > 0
          ? `Kelebihan bayar nota ${order.order_no} — gap refund Rp ${refundAmountToSave.toLocaleString('id-ID')}`
          : null,
        refundAmountToSave,
        refundAmountToSave,
        order.id
      ]
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

    return res.status(200).json({
      success: true,
      message: `Pembayaran nota ${order.order_no} diperbarui (${targetStatus})`,
      data: {
        transactionId: order.id,
        orderNo: order.order_no,
        paymentStatus: targetStatus,
        paymentMethod: method,
        paidAmount: newPaid,
        changeAmount,
        remaining: Math.max(0, grandTotal - newPaid),
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
