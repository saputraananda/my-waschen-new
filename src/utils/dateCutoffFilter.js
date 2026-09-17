/**
 * Cutoff Waschen: tanggal 26 bulan sebelumnya → 25 bulan berjalan
 * (atau 26 bulan ini → 25 bulan berikutnya jika hari ≥ 26).
 */

const pad2 = (n) => String(n).padStart(2, '0');

export const toDateKey = (value) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

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
  const y = ref.getFullYear();
  const m = ref.getMonth(); // 0-based
  const day = ref.getDate();

  let startY;
  let startM; // 0-based
  let endY;
  let endM;

  if (day >= 26) {
    // 26 bulan ini → 25 bulan depan
    startY = y;
    startM = m;
    endY = m === 11 ? y + 1 : y;
    endM = m === 11 ? 0 : m + 1;
  } else {
    // 26 bulan lalu → 25 bulan ini
    startY = m === 0 ? y - 1 : y;
    startM = m === 0 ? 11 : m - 1;
    endY = y;
    endM = m;
  }

  const start = `${startY}-${pad2(startM + 1)}-26`;
  const end = `${endY}-${pad2(endM + 1)}-25`;
  return {
    start,
    end,
    label: `${formatDateKeyId(start)} – ${formatDateKeyId(end)}`
  };
};

/**
 * Bulan cutoff = bulan tanggal akhir (25). Format 'YYYY-MM'.
 * @param {Date} [ref=new Date()]
 */
export const getCutoffMonthKey = (ref = new Date()) => getCutoffRange(ref).end.slice(0, 7);

/**
 * Periode cutoff untuk bulan pilihan user: 26 bulan sebelumnya → 25 bulan tersebut.
 * @param {string} monthKey 'YYYY-MM'
 */
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

/**
 * @param {object} order
 * @param {{ mode: 'cutoff'|'range'|'all', start?: string, end?: string, cutoffMonth?: string }} filter
 */
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
    if (!start && !end) return true;
    if (start && key < start) return false;
    if (end && key > end) return false;
    return true;
  }

  return true;
};
