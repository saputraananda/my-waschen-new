import { getWorkPercentage } from './workStatusMeta.js';

/** Kategori antrean nota — gabungan progress %, bayar, dan pengambilan barang. */
export const NOTA_QUEUE_TABS = [
  { key: 'proses_belum_bayar', label: 'Proses · Belum Bayar' },
  { key: 'proses_sudah_bayar', label: 'Proses · Sudah Bayar' },
  { key: 'selesai_ruko_belum_bayar', label: 'Selesai · Di Ruko · Belum Bayar' },
  { key: 'selesai_ruko_sudah_bayar', label: 'Selesai · Di Ruko · Sudah Bayar' },
  { key: 'selesai_diambil_belum_bayar', label: 'Selesai · Diambil · Belum Bayar' },
];

export function normalizePaymentStatus(status) {
  if (status === 'Belum Lunas') return 'Outstanding';
  return status || 'Outstanding';
}

export function isNotaPaid(order) {
  return normalizePaymentStatus(order?.paymentStatus ?? order?.payment_status) === 'Lunas';
}

export function isNotaWorkComplete(order) {
  return getWorkPercentage(order?.workStatus ?? order?.work_status) >= 100;
}

/** Barang sudah diambil pelanggan (header picked_up_at). */
export function isNotaPickedUp(order) {
  return Boolean(order?.pickedUpAt ?? order?.picked_up_at);
}

/**
 * Klasifikasi nota ke salah satu bucket antrean.
 * Selesai + diambil + lunas → selesai_diambil_sudah_bayar (biasanya tidak perlu tindakan).
 */
export function getNotaQueueCategory(order) {
  const complete = isNotaWorkComplete(order);
  const paid = isNotaPaid(order);
  const picked = isNotaPickedUp(order);

  if (!complete && !paid) return 'proses_belum_bayar';
  if (!complete && paid) return 'proses_sudah_bayar';
  if (complete && !picked && !paid) return 'selesai_ruko_belum_bayar';
  if (complete && !picked && paid) return 'selesai_ruko_sudah_bayar';
  if (complete && picked && !paid) return 'selesai_diambil_belum_bayar';
  if (complete && picked && paid) return 'selesai_diambil_sudah_bayar';
  return 'proses_belum_bayar';
}

export function getNotaQueueLabel(order) {
  const cat = getNotaQueueCategory(order);
  const tab = NOTA_QUEUE_TABS.find((t) => t.key === cat);
  if (tab) return tab.label;
  if (cat === 'selesai_diambil_sudah_bayar') return 'Selesai · Diambil · Sudah Bayar';
  return '—';
}

export function matchesNotaQueueTab(order, tabName) {
  if (!tabName || tabName === 'Semua') return true;
  return getNotaQueueCategory(order) === tabName;
}
