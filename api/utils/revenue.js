import { myWaschenPool } from '../db/pool.js';

/**
 * DEFINISI REVENUE (seragam POS & SuperApp, keputusan user 2026-11-24):
 *   Revenue = uang yang MASUK dari pembayaran nota, diakui pada jam pembayaran.
 *   - Sumber: tr_payment_log log_type DP / Lunas / Pelunasan (DP ikut dihitung saat dibayar).
 *   - Nota outstanding (belum ada pembayaran) BUKAN revenue.
 *   - Revenue Tunai  = metode Tunai/Cash; Revenue Non Tunai = metode lain (termasuk Potong Saldo Member).
 *   - Revenue Total  = Tunai + Non Tunai.
 *   - Nota lama tanpa log pembayaran (migrasi Smartlink) dihitung sebagai satu pembayaran
 *     pada tr_transaction.paid_at sebesar paid_amount (fallback grand_total).
 *   - Top-up saldo member bukan revenue.
 */

export const REVENUE_LOG_TYPES = "('DP','Lunas','Pelunasan')";

/** True bila metode bayar termasuk tunai. */
export const isTunaiMethod = (method) => /tunai|cash/i.test(String(method || ''));

/** Ekspresi SQL: 1 bila kolom metode termasuk tunai. */
export const TUNAI_SQL = (col) => `(LOWER(COALESCE(${col}, '')) REGEXP 'tunai|cash')`;

/**
 * Subquery baris pembayaran revenue dalam rentang waktu [from, to] (DATETIME WIB):
 * kolom transaction_id, amount, method, paid_at. Pakai dengan params = revenuePaymentParams(from, to).
 */
export const REVENUE_PAYMENTS_SQL = `
  SELECT pl.transaction_id, pl.amount, pl.payment_method AS method, pl.created_at AS paid_at
  FROM tr_payment_log pl
  WHERE pl.log_type IN ${REVENUE_LOG_TYPES} AND pl.amount > 0
    AND pl.created_at >= ? AND pl.created_at <= ?
  UNION ALL
  SELECT t0.id, COALESCE(NULLIF(t0.paid_amount, 0), t0.grand_total), t0.payment_method, t0.paid_at
  FROM tr_transaction t0
  WHERE t0.payment_status <> 'Outstanding' AND t0.paid_at IS NOT NULL
    AND t0.paid_at >= ? AND t0.paid_at <= ?
    AND NOT EXISTS (
      SELECT 1 FROM tr_payment_log p0
      WHERE p0.transaction_id = t0.id AND p0.log_type IN ${REVENUE_LOG_TYPES} AND p0.amount > 0
    )`;

export const revenuePaymentParams = (from, to) => [from, to, from, to];

/**
 * Sama persis dengan REVENUE_PAYMENTS_SQL (filter & params sama), ditambah kolom rincian untuk
 * daftar pembayaran (modal Dashboard): log_id, log_type, cashier_employee_id, is_legacy.
 * Ubah keduanya bersamaan.
 */
export const REVENUE_PAYMENT_DETAIL_SQL = `
  SELECT pl.id AS log_id, pl.transaction_id, pl.amount, pl.payment_method AS method, pl.created_at AS paid_at,
         pl.log_type, pl.cashier_employee_id, 0 AS is_legacy
  FROM tr_payment_log pl
  WHERE pl.log_type IN ${REVENUE_LOG_TYPES} AND pl.amount > 0
    AND pl.created_at >= ? AND pl.created_at <= ?
  UNION ALL
  SELECT NULL, t0.id, COALESCE(NULLIF(t0.paid_amount, 0), t0.grand_total), t0.payment_method, t0.paid_at,
         'Lunas', t0.cashier_employee_id, 1
  FROM tr_transaction t0
  WHERE t0.payment_status <> 'Outstanding' AND t0.paid_at IS NOT NULL
    AND t0.paid_at >= ? AND t0.paid_at <= ?
    AND NOT EXISTS (
      SELECT 1 FROM tr_payment_log p0
      WHERE p0.transaction_id = t0.id AND p0.log_type IN ${REVENUE_LOG_TYPES} AND p0.amount > 0
    )`;

const num = (v) => Number(v) || 0;

/**
 * Revenue satu outlet dalam rentang waktu: { tunai, nonTunai, total, notaCount, byMethod }.
 * `to` null = sampai sekarang.
 */
export async function getRevenueSplit({ outletId, from, to = null }, conn = myWaschenPool) {
  const until = to || '9999-12-31 23:59:59';
  const [rows] = await conn.query(
    `SELECT rp.method, COUNT(DISTINCT rp.transaction_id) AS nota_count, SUM(rp.amount) AS amount
     FROM (${REVENUE_PAYMENTS_SQL}) rp
     JOIN tr_transaction t ON t.id = rp.transaction_id
     WHERE t.outlet_id = ? AND t.is_delete_requested = 0
     GROUP BY rp.method`,
    [...revenuePaymentParams(from, until), outletId]
  );
  const [[cnt]] = await conn.query(
    `SELECT COUNT(DISTINCT rp.transaction_id) AS n
     FROM (${REVENUE_PAYMENTS_SQL}) rp
     JOIN tr_transaction t ON t.id = rp.transaction_id
     WHERE t.outlet_id = ? AND t.is_delete_requested = 0`,
    [...revenuePaymentParams(from, until), outletId]
  );
  let tunai = 0;
  let nonTunai = 0;
  const byMethod = {};
  for (const r of rows) {
    const amount = num(r.amount);
    const method = String(r.method || 'Lainnya').trim() || 'Lainnya';
    byMethod[method] = (byMethod[method] || 0) + amount;
    if (isTunaiMethod(method)) tunai += amount;
    else nonTunai += amount;
  }
  return { tunai, nonTunai, total: tunai + nonTunai, notaCount: num(cnt?.n), byMethod };
}

/**
 * Awal rentang pembayaran sebuah shift = tepat setelah closing shift sebelumnya di outlet itu
 * (fallback opened_at bila belum pernah ada closing). Selain Frontliner boleh menerima pembayaran
 * saat tidak ada shift terbuka; uang di sela antar-shift itu jadi tanggung jawab shift berikutnya,
 * sama seperti nota yatim (adoptOrphanTransactions). Rentang antar-shift tidak tumpang tindih
 * karena hanya satu shift boleh terbuka per outlet.
 */
export async function getShiftPaymentFrom(shift, conn = myWaschenPool) {
  if (!shift?.opened_at) return shift?.opened_at || null;
  const [[row]] = await conn.query(
    `SELECT DATE_ADD(MAX(closed_at), INTERVAL 1 SECOND) AS from_at
     FROM tr_cashier_shift
     WHERE outlet_id = ? AND id <> ? AND status = 'Closed'
       AND closed_at IS NOT NULL AND closed_at <= ?`,
    [shift.outlet_id, shift.id || 0, shift.opened_at]
  );
  return row?.from_at || shift.opened_at;
}

/** Revenue sebuah shift = pembayaran sejak closing shift sebelumnya sampai closed_at (atau sekarang). */
export async function getShiftRevenue(shift, conn = myWaschenPool) {
  const from = await getShiftPaymentFrom(shift, conn);
  return getRevenueSplit({ outletId: shift.outlet_id, from, to: shift.closed_at || null }, conn);
}
