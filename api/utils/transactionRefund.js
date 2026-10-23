/**
 * Pengajuan refund per nota (tabel tr_transaction_refund, Phase 13).
 * POS hanya mengajukan; approve / tolak dilakukan admin di Alora SuperApp.
 */
export const REFUND_TYPES = ['Refund', 'Deposit', 'Tips'];

export async function findPendingRefund(conn, transactionId) {
  const [rows] = await conn.query(
    `SELECT id, refund_type, amount FROM tr_transaction_refund
     WHERE transaction_id = ? AND status = 'Pending'
     ORDER BY id DESC LIMIT 1`,
    [transactionId]
  );
  return rows[0] || null;
}

export async function insertRefundRequest(conn, {
  transactionId,
  refundType,
  source = 'Manual',
  amount,
  reason,
  paymentProofUrl = null,
  attachmentUrl = null,
  requestedByEmployeeId = null
}) {
  const [result] = await conn.query(
    `INSERT INTO tr_transaction_refund
     (transaction_id, refund_type, source, amount, reason, payment_proof_url, attachment_url, requested_by_employee_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      transactionId,
      refundType,
      source,
      amount,
      reason,
      paymentProofUrl,
      attachmentUrl,
      requestedByEmployeeId
    ]
  );
  return result.insertId;
}

/** Subquery ringkas status refund per nota untuk daftar transaksi. */
export const REFUND_SUMMARY_COLUMNS = `
  (SELECT COUNT(*) FROM tr_transaction_refund rf WHERE rf.transaction_id = t.id AND rf.status = 'Pending') AS refund_pending_count,
  (SELECT COUNT(*) FROM tr_transaction_refund rf WHERE rf.transaction_id = t.id) AS refund_count`;
