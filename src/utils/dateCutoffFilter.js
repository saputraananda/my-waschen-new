/**
 * Cutoff Waschen: tanggal 26 bulan sebelumnya → 25 bulan berjalan
 * (atau 26 bulan ini → 25 bulan berikutnya jika hari ≥ 26).
 * Semua kunci tanggal memakai kalender Asia/Jakarta.
 */
import { toWibDateKey } from './wib.js';

const pad2 = (n) => String(n).padStart(2, '0');

export const toDateKey = (value) => toWibDateKey(value) || '';

export const formatDateKeyId = (key) => {
  if (!key) return '—';
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${pad2(d)} ${months[m - 1]} ${y}`;
};

/**
 * @param {Date} [ref=new Date()]
 * @returns {{ start: string, end: string, label: string }} YYYY-MM-DD
 */
export const getCutoffRange = (ref = new Date()) => {
  const key = toWibDateKey(ref);
  const [y, m, day] = (key || '1970-01-01').split('-').map(Number);
  const monthIndex = m - 1; // 0-based

  let startY;
  let startM;
  let endY;
  let endM;

  if (day >= 26) {
    startY = y;
    startM = monthIndex;
    endY = monthIndex === 11 ? y + 1 : y;
    endM = monthIndex === 11 ? 0 : monthIndex + 1;
  } else {
    startY = monthIndex === 0 ? y - 1 : y;
    startM = monthIndex === 0 ? 11 : monthIndex - 1;
    endY = y;
    endM = monthIndex;
  }

  const start = `${startY}-${pad2(startM + 1)}-26`;
  const end = `${endY}-${pad2(endM + 1)}-25`;
  return {
    start,
    end,
    label: `${formatDateKeyId(start)} – ${formatDateKeyId(end)}`
  };
};

export const getCutoffMonthKey = (ref = new Date()) => getCutoffRange(ref).end.slice(0, 7);

export const getCutoffRangeForMonth = (monthKey) => {
  const [y, m] = String(monthKey || '').split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return getCutoffRange();

  const startY = m === 1 ? y - 1 : y;
  const startM = m === 1 ? 12 : m - 1;
  const start = `${startY}-${pad2(startM)}-26`;
  const end = `${y}-${pad2(m)}-25`;
  return {
    start,
    end,
    label: `${formatDateKeyId(start)} – ${formatDateKeyId(end)}`
  };
};

export const getOrderDateKey = (order) => {
  if (!order) return '';
  return toDateKey(
    order.rawDate
    || order.createdAtRaw
    || order.order_date
    || order.orderDate
    || order.createdAt
  );
};

export const passesDateModeFilter = (order, filter) => {
  if (!filter || filter.mode === 'all') return true;

  const key = getOrderDateKey(order);
  if (!key) return false;

  if (filter.mode === 'cutoff') {
    const range = filter.cutoffMonth
      ? getCutoffRangeForMonth(filter.cutoffMonth)
      : getCutoffRange();
    return key >= range.start && key <= range.end;
  }

  if (filter.mode === 'range') {
    const start = filter.start || '';
    const end = filter.end || '';
    if (start && key < start) return false;
    if (end && key > end) return false;
    return true;
  }

  return true;
};
