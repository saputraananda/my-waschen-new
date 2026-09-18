/**
 * Helpers filter / format tanggal untuk Riwayat & Dashboard — selalu WIB.
 */
import { toWibDateKey, todayWibISO, WIB_TZ } from './wib.js';

export function toDateInputValue(date = new Date()) {
  return toWibDateKey(date) || '';
}

export function formatDateId(date, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (date == null || date === '') return '-';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { timeZone: WIB_TZ, ...options });
}

export function matchesDateFilter(orderDate, dateFilterYmd) {
  if (!dateFilterYmd) return true;
  const key = toWibDateKey(orderDate);
  if (!key) return false;
  return key === dateFilterYmd;
}

export { todayWibISO, toWibDateKey };
