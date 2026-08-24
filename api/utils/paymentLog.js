/**
 * Helper log & resolve status pembayaran transaksi
 */
export const insertPaymentLog = async (connection, {
  transactionId,
  logType,
  amount,
  paymentMethod,
  paymentProofUrl,
  notes,
  cashierEmployeeId
}) => {
  await connection.query(
    `INSERT INTO tr_payment_log
     (transaction_id, log_type, amount, payment_method, payment_proof_url, notes, cashier_employee_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      transactionId,
      logType,
      parseFloat(amount) || 0,
      paymentMethod || null,
      paymentProofUrl || null,
      notes || null,
      cashierEmployeeId || null
    ]
  );
};

export const resolvePaymentStatus = (paidAmount, grandTotal) => {
  const paid = parseFloat(paidAmount) || 0;
  const total = parseFloat(grandTotal) || 0;
  if (paid <= 0) return 'Outstanding';
  if (paid >= total) return 'Lunas';
  return 'DP';
};

export const buildPaymentProofUrl = (filename) => {
  if (!filename) return null;
  return `/uploads/assets/payment_proof/${filename}`;
};
