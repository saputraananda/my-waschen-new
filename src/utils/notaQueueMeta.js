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

/**
 * Cucian sudah siap / selesai proses (≥90%):
 * Siap Diambil, Siap Diantar, Sedang Diantar, atau Selesai.
 */
export function isNotaWorkComplete(order) {
  return getWorkPercentage(order?.workStatus ?? order?.work_status) >= 90;
}

/**
 * Sudah diserahkan ke customer:
 * - header picked_up_at terisi, ATAU
 * - progress header ≥100% (semua item Selesai / sudah diantar).
 */
export function isNotaPickedUp(order) {
  if (order?.pickedUpAt ?? order?.picked_up_at) return true;
  return getWorkPercentage(order?.workStatus ?? order?.work_status) >= 100;
}

/**
 * Klasifikasi nota ke salah satu bucket antrean.
 *
 * Di Ruko  = siap (≥90%) tapi belum diserahkan (<100% / belum picked_up)
 * Diambil  = sudah diserahkan (≥100% atau picked_up_at)
 * Selesai · Diambil · Sudah Bayar biasanya tidak ditampilkan di tab utama.
 */
export function getNotaQueueCategory(order) {
  const ready = isNotaWorkComplete(order);
  const paid = isNotaPaid(order);
  const picked = isNotaPickedUp(order);

  if (!ready && !paid) return 'proses_belum_bayar';
  if (!ready && paid) return 'proses_sudah_bayar';
  if (ready && !picked && !paid) return 'selesai_ruko_belum_bayar';
  if (ready && !picked && paid) return 'selesai_ruko_sudah_bayar';
  if (ready && picked && !paid) return 'selesai_diambil_belum_bayar';
  if (ready && picked && paid) return 'selesai_diambil_sudah_bayar';
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
