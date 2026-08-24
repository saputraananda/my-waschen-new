/**
 * Helpers filter / format tanggal untuk Riwayat & Dashboard.
 */
export function toDateInputValue(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function formatDateId(date, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', options);
}

export function matchesDateFilter(orderDate, dateFilterYmd) {
  if (!dateFilterYmd) return true;
  const d = orderDate instanceof Date ? orderDate : new Date(orderDate);
  if (Number.isNaN(d.getTime())) return false;
  return toDateInputValue(d) === dateFilterYmd;
}
