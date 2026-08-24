/**
 * Mutasi saldo deposit pelanggan saat pembayaran transaksi.
 * - Saldo Member: potong grand_total (Usage)
 * - Kelebihan bayar: opsional masuk deposit (Topup) atau kembalian tunai
 */
export async function applyDepositOnPayment(connection, {
  customerId,
  orderNo,
  grandTotal,
  paymentMethod,
  paidAmount,
  overpaymentToDeposit = false,
  outletId,
  cashierEmployeeId
}) {
  const total = parseFloat(grandTotal) || 0;
  if (total <= 0) {
    return { paidAmount: 0, changeAmount: 0, depositDelta: 0, balanceAfter: null };
  }

  const [pmRows] = await connection.query(
    `SELECT id, requires_member_balance FROM mst_payment_method
     WHERE is_active = 1 AND (name = ? OR label = ? OR code = ?)
     LIMIT 1`,
    [paymentMethod || '', paymentMethod || '', String(paymentMethod || '').toUpperCase()]
  );

  const isMemberBalance = pmRows[0]?.requires_member_balance === 1
    || /saldo member/i.test(paymentMethod || '');

  const [custRows] = await connection.query(
    'SELECT id, deposit_balance FROM mst_customer WHERE id = ? LIMIT 1',
    [customerId]
  );
  if (!custRows.length) {
    throw new Error('Pelanggan tidak ditemukan');
  }

  const balanceBefore = parseFloat(custRows[0].deposit_balance) || 0;
  let balanceAfter = balanceBefore;
  let finalPaid = parseFloat(paidAmount);
  let changeAmount = 0;
  let depositDelta = 0;

  if (isMemberBalance) {
    if (balanceBefore < total) {
      throw new Error(
        `Saldo member tidak cukup (tersedia Rp ${balanceBefore.toLocaleString('id-ID')})`
      );
    }

    balanceAfter = balanceBefore - total;
    depositDelta = -total;

    await connection.query(
      'UPDATE mst_customer SET deposit_balance = ?, updated_at = NOW() WHERE id = ?',
      [balanceAfter, customerId]
    );

    await connection.query(
      `INSERT INTO tr_customer_deposit
       (customer_id, outlet_id, cashier_employee_id, type, amount, balance_before, balance_after, payment_method, notes)
       VALUES (?, ?, ?, 'Usage', ?, ?, ?, ?, ?)`,
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
      changeAmount: 0,
      depositDelta,
      balanceAfter,
      isMemberBalance: true
    };
  }

  if (Number.isNaN(finalPaid) || finalPaid <= 0) {
    finalPaid = total;
  }

  if (finalPaid < total) {
    throw new Error('Nominal bayar kurang dari total tagihan');
  }

  const excess = Math.round((finalPaid - total) * 100) / 100;

  if (excess > 0 && overpaymentToDeposit) {
    balanceAfter = balanceBefore + excess;
    depositDelta = excess;

    await connection.query(
      'UPDATE mst_customer SET deposit_balance = ?, updated_at = NOW() WHERE id = ?',
      [balanceAfter, customerId]
    );

    await connection.query(
      `INSERT INTO tr_customer_deposit
       (customer_id, outlet_id, cashier_employee_id, type, amount, balance_before, balance_after, payment_method, notes)
       VALUES (?, ?, ?, 'Topup', ?, ?, ?, ?, ?)`,
      [
        customerId,
        outletId || null,
        cashierEmployeeId || null,
        excess,
        balanceBefore,
        balanceAfter,
        paymentMethod || 'Tunai',
        `Kelebihan bayar nota ${orderNo}`
      ]
    );
  } else if (excess > 0) {
    changeAmount = excess;
  }

  return {
    paidAmount: finalPaid,
    changeAmount,
    depositDelta,
    balanceAfter: depositDelta > 0 ? balanceAfter : balanceBefore,
    isMemberBalance: false
  };
}
