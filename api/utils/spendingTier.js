/**
 * Tier spending organik: VIP, Gold, Reguler, One-Time
 * Dipisah dari membership (Diamond/Gold paket deposit).
 */

const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const resolveSpendingTierId = (tiers, { monthlySpending, totalOrders }) => {
  const monthly = parseFloat(monthlySpending) || 0;
  const orders = parseInt(totalOrders, 10) || 0;

  const sorted = [...tiers].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  for (const tier of sorted) {
    const minMonthly = tier.min_monthly_spending != null ? parseFloat(tier.min_monthly_spending) : null;
    const maxMonthly = tier.max_monthly_spending != null ? parseFloat(tier.max_monthly_spending) : null;
    const minOrders = tier.min_total_orders != null ? parseInt(tier.min_total_orders, 10) : null;
    const maxOrders = tier.max_total_orders != null ? parseInt(tier.max_total_orders, 10) : null;

    if (minMonthly != null && monthly < minMonthly) continue;
    if (maxMonthly != null && monthly > maxMonthly) continue;
    if (minOrders != null && orders < minOrders) continue;
    if (maxOrders != null && orders > maxOrders) continue;

    return tier.id;
  }

  const oneTime = tiers.find((t) => t.code === 'ONE_TIME');
  return oneTime?.id || tiers[tiers.length - 1]?.id || null;
};

export async function loadActiveSpendingTiers(connection) {
  const [rows] = await connection.query(
    `SELECT id, code, name, min_monthly_spending, max_monthly_spending,
            min_total_orders, max_total_orders, sort_order
     FROM mst_customer_tier
     WHERE is_active = 1
     ORDER BY sort_order ASC`
  );
  return rows;
}

/**
 * Update monthly_spending + spending_tier_id setelah transaksi lunas.
 */
export async function applyTransactionSpendingUpdate(connection, customerId, paidAmount) {
  const amount = parseFloat(paidAmount) || 0;
  if (!customerId || amount <= 0) return null;

  const period = currentPeriod();

  const [custRows] = await connection.query(
    `SELECT id, total_orders, total_spent, monthly_spending, monthly_spending_period, spending_tier_id
     FROM mst_customer WHERE id = ? LIMIT 1`,
    [customerId]
  );
  if (!custRows.length) return null;

  const customer = custRows[0];
  const newTotalOrders = (parseInt(customer.total_orders, 10) || 0) + 1;
  const newTotalSpent = (parseFloat(customer.total_spent) || 0) + amount;
  const samePeriod = customer.monthly_spending_period === period;
  const newMonthlySpending = (samePeriod ? parseFloat(customer.monthly_spending) || 0 : 0) + amount;

  const tiers = await loadActiveSpendingTiers(connection);
  const newTierId = resolveSpendingTierId(tiers, {
    monthlySpending: newMonthlySpending,
    totalOrders: newTotalOrders
  });

  await connection.query(
    `UPDATE mst_customer
     SET total_orders = ?,
         total_spent = ?,
         monthly_spending = ?,
         monthly_spending_period = ?,
         spending_tier_id = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [newTotalOrders, newTotalSpent, newMonthlySpending, period, newTierId, customerId]
  );

  return { spendingTierId: newTierId, monthlySpending: newMonthlySpending, totalOrders: newTotalOrders };
}
