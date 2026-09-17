import path from 'path';
import { myWaschenPool } from '../db/pool.js';
import { emitDashboardRefresh } from '../socket.js';
import { applyDepositOnPayment } from '../utils/customerDeposit.js';
import {
  insertPaymentLog,
  resolvePaymentStatus,
  buildPaymentProofUrl
} from '../utils/paymentLog.js';
import { uploadPaymentReceipt, replaceUploadUrl, safeUnlinkAbsPath } from '../middleware/upload.js';

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

    let settledByName = null;
    if (order.settled_by_employee_id) {
      const [settlerRows] = await myWaschenPool.query(
        `SELECT COALESCE(NULLIF(TRIM(employee_name), ''), CONCAT('Karyawan #', employee_id)) AS name
         FROM mst_role WHERE employee_id = ? LIMIT 1`,
        [order.settled_by_employee_id]
      );
      settledByName = settlerRows[0]?.name || null;
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

    // Prioritas: additionalAmount / paidAmount dulu.
    // Jangan cek Outstanding dulu — kalau nota masih Outstanding tapi ada
    // nominal pelunasan, harus diproses (bug: bayar + PIN sukses tapi paid tetap 0).
    if (additionalAmount !== undefined && additionalAmount !== null) {
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
    } else if (String(paymentStatus || '') === 'Outstanding') {
      // Hanya reset jika client eksplisit set Outstanding (tanpa nominal)
      targetStatus = 'Outstanding';
      newPaid = 0;
      changeAmount = 0;
    }

    const method = targetStatus === 'Outstanding' ? '-' : (paymentMethod || order.payment_method || 'Tunai');
    const proofUrl = paymentProofUrl || order.payment_proof_url;
    const settlerId = cashierEmployeeId || order.cashier_employee_id || null;
    const shouldStampSettler = targetStatus !== 'Outstanding' && newPaid > 0;

    await connection.query(
      `UPDATE tr_transaction SET
         payment_status = ?,
         payment_method = ?,
         paid_amount = ?,
         change_amount = ?,
         payment_proof_url = ?,
         paid_at = CASE WHEN ? = 'Lunas' THEN NOW() WHEN paid_at IS NULL AND ? > 0 THEN NOW() ELSE paid_at END,
         settled_by_employee_id = CASE WHEN ? THEN ? ELSE settled_by_employee_id END,
         settled_at = CASE WHEN ? THEN NOW() ELSE settled_at END,
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
        shouldStampSettler ? 1 : 0,
        settlerId,
        shouldStampSettler ? 1 : 0,
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

    // Hapus file bukti lama jika diganti URL baru
    if (proofUrl && order.payment_proof_url && proofUrl !== order.payment_proof_url) {
      await replaceUploadUrl(order.payment_proof_url, proofUrl);
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
