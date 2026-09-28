import { getWibYearMonth } from './wib.js';

/**
 * Tier spending organik: VIP, Gold, Reguler, One-Time
 * Dipisah dari membership (Diamond/Gold paket deposit).
 */

const tierIdByCode = (tiers, code) => tiers.find((t) => t.code === code)?.id || null;

/**
 * VIP/Gold: belanja periode ini, atau spending tahun sudah menutup jatah
 * bulan ke-N (N × ambang bulanan). Di bawah itu: order ≤ 1 = One-Time, selain itu Reguler.
 * monthIndex kosong = jalur tahun tidak dipakai (pemanggil lama, mis. migrasi dengan spending 0).
 */
export const resolveSpendingTierId = (tiers, { monthlySpending, yearSpending, monthIndex, totalOrders } = {}) => {
  const period = parseFloat(monthlySpending) || 0;
  const year = parseFloat(yearSpending) || 0;
  const orders = parseInt(totalOrders, 10) || 0;
  const month = monthIndex == null || monthIndex === '' ? null : Math.max(1, parseInt(monthIndex, 10) || 1);
  const vipBar = parseFloat(tiers.find((t) => t.code === 'VIP')?.min_monthly_spending) || 1000000;
  const goldBar = parseFloat(tiers.find((t) => t.code === 'GOLD')?.min_monthly_spending) || 500000;
  const qualifies = (bar) => period >= bar || (month != null && year >= bar * month);

  if (qualifies(vipBar)) return tierIdByCode(tiers, 'VIP');
  if (qualifies(goldBar)) return tierIdByCode(tiers, 'GOLD');
  if (orders <= 1) return tierIdByCode(tiers, 'ONE_TIME');
  return tierIdByCode(tiers, 'REGULER') || tiers[tiers.length - 1]?.id || null;
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
 * Update spending + tier setelah nota dibuat. grand_total sekali per nota.
 * Periode = bulan kalender WIB. Tahun berganti → spending_value_year mulai dari nota ini.
 */
export async function applyTransactionSpendingUpdate(connection, customerId, paidAmount) {
  const amount = parseFloat(paidAmount) || 0;
  if (!customerId || amount <= 0) return null;

  const { year, month } = getWibYearMonth();
  const period = `${year}-${String(month).padStart(2, '0')}`;
  const yearKey = String(year);

  const [custRows] = await connection.query(
    `SELECT id, total_orders, total_spent, monthly_spending, monthly_spending_period,
            spending_value_year, spending_year, spending_tier_id
     FROM mst_customer WHERE id = ? LIMIT 1`,
    [customerId]
  );
  if (!custRows.length) return null;

  const customer = custRows[0];
  const newTotalOrders = (parseInt(customer.total_orders, 10) || 0) + 1;
  const newTotalSpent = (parseFloat(customer.total_spent) || 0) + amount;
  const samePeriod = customer.monthly_spending_period === period;
  const sameYear = String(customer.spending_year || '') === yearKey;
  const newMonthlySpending = (samePeriod ? parseFloat(customer.monthly_spending) || 0 : 0) + amount;
  const newYearSpending = (sameYear ? parseFloat(customer.spending_value_year) || 0 : 0) + amount;

  const tiers = await loadActiveSpendingTiers(connection);
  const newTierId = resolveSpendingTierId(tiers, {
    monthlySpending: newMonthlySpending,
    yearSpending: newYearSpending,
    monthIndex: month,
    totalOrders: newTotalOrders
  });

  await connection.query(
    `UPDATE mst_customer
     SET total_orders = ?,
         total_spent = ?,
         monthly_spending = ?,
         monthly_spending_period = ?,
         spending_value_year = ?,
         spending_year = ?,
         spending_tier_id = ?,
         last_transaction_at = NOW(),
         updated_at = NOW()
     WHERE id = ?`,
    [newTotalOrders, newTotalSpent, newMonthlySpending, period, newYearSpending, yearKey, newTierId, customerId]
  );

  return {
    spendingTierId: newTierId,
    monthlySpending: newMonthlySpending,
    yearSpending: newYearSpending,
    totalOrders: newTotalOrders
  };
}
