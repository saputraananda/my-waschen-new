import { REVENUE_LOG_TYPES } from './revenue.js';

/**
 * Request Hapus Pelunasan — kasir mengajukan pembatalan PEMBAYARAN TERAKHIR nota (nota tidak dihapus).
 * Disetujui / ditolak di SuperApp (tabel tr_payment_void_request, lihat agent/migrate_payment_void.sql).
 */

/** Pembayaran terakhir yang masih dihitung revenue; nota lama tanpa log → pembayaran dari tr_transaction. */
export async function findLastPayment(conn, order) {
  const [logs] = await conn.query(
    `SELECT id, log_type, amount, payment_method, created_at
     FROM tr_payment_log
     WHERE transaction_id = ? AND log_type IN ${REVENUE_LOG_TYPES} AND amount > 0
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [order.id]
  );
  if (logs.length) {
    const l = logs[0];
    return {
      paymentLogId: l.id,
      logType: l.log_type,
      amount: Number(l.amount) || 0,
      paymentMethod: l.payment_method || order.payment_method || null,
      paidAt: l.created_at
    };
  }
  const paid = Number(order.paid_amount) || 0;
  if (order.payment_status !== 'Outstanding' && order.paid_at && paid > 0) {
    return {
      paymentLogId: null,
      logType: order.payment_status === 'Lunas' ? 'Lunas' : 'DP',
      amount: paid,
      paymentMethod: order.payment_method || null,
      paidAt: order.paid_at
    };
  }
  return null;
}

export async function findPendingVoid(conn, transactionId) {
  try {
    const [rows] = await conn.query(
      "SELECT id FROM tr_payment_void_request WHERE transaction_id = ? AND status = 'Pending' LIMIT 1",
      [transactionId]
    );
    return rows[0] || null;
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return null; // migrasi belum dijalankan
    throw err;
  }
}
