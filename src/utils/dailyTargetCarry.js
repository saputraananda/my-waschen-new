import {
  getCutoffRangeForMonth,
  getCutoffMonthKey,
  toDateKey,
  getOrderDateKey,
  passesDateModeFilter
} from './dateCutoffFilter.js';

const pad2 = (n) => String(n).padStart(2, '0');

/** Daftar tanggal YYYY-MM-DD inklusif dari start → end. */
export function listDateKeysInclusive(startKey, endKey) {
  const start = toDateKey(startKey);
  const end = toDateKey(endKey);
  if (!start || !end || start > end) return [];
  const out = [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const cursor = new Date(sy, sm - 1, sd);
  for (;;) {
    const key = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-${pad2(cursor.getDate())}`;
    if (key > end) break;
    out.push(key);
    cursor.setDate(cursor.getDate() + 1);
    if (out.length > 400) break;
  }
  return out;
}

/**
 * Target harian = target periode / jumlah hari.
 * Shortfall hari sebelumnya di-carry ke hari berikutnya (surplus tidak mengurangi).
 *
 * @param {number} periodTarget
 * @param {string[]} dayKeys YYYY-MM-DD terurut
 * @param {Record<string, number>} revenueByDay
 * @param {string} asOfKey hari yang ditampilkan (efektif target hari ini)
 */
export function computeCarryDailyTarget(periodTarget, dayKeys, revenueByDay = {}, asOfKey = '') {
  const days = Array.isArray(dayKeys) ? dayKeys : [];
  const dayCount = Math.max(1, days.length);
  const baseDaily = Math.round(Number(periodTarget || 0) / dayCount);
  const asOf = asOfKey || days[days.length - 1] || '';

  let carry = 0;
  const byDay = {};
  let focus = null;

  for (const key of days) {
    const effectiveTarget = baseDaily + carry;
    const actual = Math.max(0, Number(revenueByDay[key]) || 0);
    const shortfall = Math.max(0, effectiveTarget - actual);
    const over = Math.max(0, actual - effectiveTarget);
    const row = {
      dateKey: key,
      baseDaily,
      carryIn: carry,
      effectiveTarget,
      actual,
      shortfall,
      over,
      progressPct: effectiveTarget > 0 ? Math.min(100, (actual / effectiveTarget) * 100) : 0
    };
    byDay[key] = row;
    if (key === asOf) focus = row;
    carry = shortfall; // hanya sisa yang belum tercapai
    if (asOf && key === asOf) break; // carry setelah asOf tidak perlu untuk UI hari ini
  }

  if (!focus && days.length) {
    focus = byDay[days[Math.min(days.length - 1, days.findIndex((d) => d >= asOf) || days.length - 1)]] || byDay[days[days.length - 1]];
  }

  return {
    dayCount,
    baseDaily,
    asOfKey: focus?.dateKey || asOf,
    today: focus || {
      dateKey: asOf,
      baseDaily,
      carryIn: 0,
      effectiveTarget: baseDaily,
      actual: 0,
      shortfall: baseDaily,
      over: 0,
      progressPct: 0
    },
    byDay
  };
}

/** Revenue lunas per hari (YYYY-MM-DD → number). */
export function buildPaidRevenueByDay(orders) {
  const map = {};
  for (const o of orders || []) {
    if ((o.paymentStatus || o.payment_status) !== 'Lunas') continue;
    const key = getOrderDateKey(o);
    if (!key) continue;
    map[key] = (map[key] || 0) + (Number(o.totalAmount ?? o.grandTotal ?? o.grand_total) || 0);
  }
  return map;
}

/**
 * Resolve rentang aktif dari DateModeFilter state.
 */
export function resolveStatDateRange(filter) {
  if (!filter || filter.mode === 'cutoff') {
    const month = filter?.cutoffMonth || getCutoffMonthKey();
    return getCutoffRangeForMonth(month);
  }
  if (filter.mode === 'range') {
    const start = filter.start || '';
    const end = filter.end || '';
    if (start && end) {
      return {
        start,
        end: end < start ? start : end,
        label: `${start} – ${end}`
      };
    }
    if (start) return { start, end: start, label: start };
    if (end) return { start: end, end, label: end };
    return getCutoffRangeForMonth(getCutoffMonthKey());
  }
  return getCutoffRangeForMonth(getCutoffMonthKey());
}

/** Hari "fokus" untuk target harian: hari ini jika masih dalam range, else clamp. */
export function resolveAsOfDateKey(range, now = new Date()) {
  const today = toDateKey(now);
  if (!range?.start || !range?.end) return today;
  if (today < range.start) return range.start;
  if (today > range.end) return range.end;
  return today;
}

export function filterOrdersByDateMode(orders, filter) {
  return (orders || []).filter((o) => passesDateModeFilter(o, filter));
}

export function sumPaidRevenue(orders) {
  return (orders || [])
    .filter((o) => (o.paymentStatus || o.payment_status) === 'Lunas')
    .reduce((acc, o) => acc + (Number(o.totalAmount ?? o.grandTotal ?? o.grand_total) || 0), 0);
}

export function countPaidNota(orders) {
  return (orders || []).filter((o) => (o.paymentStatus || o.payment_status) === 'Lunas').length;
}

export function summarizePiutang(orders) {
  const unpaid = (orders || []).filter((o) => {
    const ps = o.paymentStatus || o.payment_status;
    return ps && ps !== 'Lunas';
  });
  const amount = unpaid.reduce((acc, o) => {
    const total = Number(o.totalAmount ?? o.grandTotal ?? o.grand_total) || 0;
    const paid = Number(o.paidAmount ?? o.paid_amount) || 0;
    return acc + Math.max(0, total - paid);
  }, 0);
  return { count: unpaid.length, amount };
}
