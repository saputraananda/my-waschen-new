/**
 * Mutasi saldo deposit pelanggan saat pembayaran transaksi.
 * Nominal bayar dikunci = grand_total (Phase 13): tidak ada lagi kembalian,
 * deposit, atau refund kelebihan bayar di sini. Kelebihan bayar diajukan
 * lewat aksi Refund di Riwayat (tr_transaction_refund).
 * - Saldo Member: potong grand_total (Payment_Debit)
 * - Metode lain: tercatat persis grand_total
 */
export async function applyDepositOnPayment(connection, {
  customerId,
  orderNo,
  grandTotal,
  paymentMethod,
  outletId,
  cashierEmployeeId
}) {
  const total = parseFloat(grandTotal) || 0;
  if (total <= 0) {
    return { paidAmount: 0, depositDelta: 0, balanceAfter: null };
  }

  const [pmRows] = await connection.query(
    `SELECT id, requires_member_balance FROM mst_payment_method
     WHERE is_active = 1 AND (name = ? OR label = ? OR code = ?)
     LIMIT 1`,
    [paymentMethod || '', paymentMethod || '', String(paymentMethod || '').toUpperCase()]
  );

  const isMemberBalance = pmRows[0]?.requires_member_balance === 1
    || /saldo member/i.test(paymentMethod || '');

  if (!isMemberBalance) {
    return { paidAmount: total, depositDelta: 0, balanceAfter: null, isMemberBalance: false };
  }

  const [custRows] = await connection.query(
    'SELECT id, deposit_balance FROM mst_customer WHERE id = ? LIMIT 1 FOR UPDATE',
    [customerId]
  );
  if (!custRows.length) {
    throw new Error('Pelanggan tidak ditemukan');
  }

  const balanceBefore = parseFloat(custRows[0].deposit_balance) || 0;
  if (balanceBefore < total) {
    throw new Error(
      `Saldo member tidak cukup (tersedia Rp ${balanceBefore.toLocaleString('id-ID')})`
    );
  }

  const balanceAfter = balanceBefore - total;

  await connection.query(
    'UPDATE mst_customer SET deposit_balance = ?, updated_at = NOW() WHERE id = ?',
    [balanceAfter, customerId]
  );

  // enum type: Topup | Payment_Debit | Refund | Bonus
  await connection.query(
    `INSERT INTO tr_customer_deposit
     (customer_id, outlet_id, cashier_employee_id, type, amount, balance_before, balance_after, payment_method, notes)
     VALUES (?, ?, ?, 'Payment_Debit', ?, ?, ?, ?, ?)`,
    [
      customerId,
      outletId || null,
      cashierEmployeeId || null,
      total,
      balanceBefore,
      balanceAfter,
      paymentMethod || 'Saldo Member',
      `Pembayaran nota ${orderNo}`
    ]
  );

  return {
    paidAmount: total,
    depositDelta: -total,
    balanceAfter,
    isMemberBalance: true
  };
}
