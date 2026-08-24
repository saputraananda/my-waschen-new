/**
 * Persentase per status (mst_work_status.id)
 * 1 Antrean 10% · 2 Pencucian 25% · 3 Penyetrikaan 50% · 4 Pengemasan 75%
 * 5 Siap Diambil / 6 Siap Diantar 90% · 7 Selesai 100% · 8 Dibatalkan 0%
 *
 * Header tr_transaction.work_status = rata-rata persentase semua item detail.
 * Contoh: (10+25+25+25+100) / 5 = 37
 */
export const WORK_STATUS_PERCENTAGE = {
  Antrean: 10,
  Diterima: 10,
  Pencucian: 25,
  'Proses Cuci': 25,
  Penyetrikaan: 50,
  'Proses Setrika': 50,
  Pengemasan: 75,
  'Proses Packing': 75,
  'Siap Diambil': 90,
  'Siap Diantar': 90,
  Delivery: 90,
  Selesai: 100,
  Dibatalkan: 0
};

export function statusPercentage(status) {
  if (status == null || status === '') return 10;
  if (typeof status === 'number' && Number.isFinite(status)) return Number(status);
  const raw = String(status).trim();
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return WORK_STATUS_PERCENTAGE[raw] ?? 10;
}

/**
 * Rata-rata persentase semua item (termasuk Dibatalkan = 0%).
 */
export function computeAccumulatedWorkPercentage(itemStatuses, fallback = 10) {
  const list = (itemStatuses || []).filter((s) => s != null && s !== '');
  if (!list.length) {
    const fb = Number(fallback);
    return Number.isFinite(fb) ? Math.round(fb * 100) / 100 : 10;
  }
  const sum = list.reduce((acc, s) => acc + statusPercentage(s), 0);
  return Math.round((sum / list.length) * 100) / 100;
}

/** @deprecated gunakan computeAccumulatedWorkPercentage */
export function computeAccumulatedWorkStatus(itemStatuses, fallback = 10) {
  return computeAccumulatedWorkPercentage(itemStatuses, fallback);
}

export async function refreshHeaderWorkPercentage(db, transactionId) {
  const [items] = await db.query(
    'SELECT item_work_status FROM tr_transaction_detail WHERE transaction_id = ?',
    [transactionId]
  );
  const percentage = computeAccumulatedWorkPercentage(
    items.map((i) => i.item_work_status)
  );
  await db.query(
    'UPDATE tr_transaction SET work_status = ? WHERE id = ?',
    [percentage, transactionId]
  );
  return percentage;
}

export function nextLifecycleStatus(current, isDelivery = false) {
  const lifecycle = [
    'Antrean',
    'Pencucian',
    'Penyetrikaan',
    'Pengemasan',
    isDelivery ? 'Siap Diantar' : 'Siap Diambil',
    'Selesai'
  ];
  if (typeof current === 'string' && lifecycle.includes(current)) {
    const idx = lifecycle.indexOf(current);
    return lifecycle[Math.min(idx + 1, lifecycle.length - 1)];
  }
  const pct = statusPercentage(current);
  let idx = 0;
  for (let i = 0; i < lifecycle.length; i += 1) {
    if (pct + 0.001 >= statusPercentage(lifecycle[i])) idx = i;
  }
  return lifecycle[Math.min(idx + 1, lifecycle.length - 1)];
}

export function workStatusTabSql(tabName, column = 't.work_status') {
  if (!tabName || tabName === 'Semua') return { sql: '1=1', params: [] };
  if (tabName === 'Proses') return { sql: `${column} > 10 AND ${column} < 90`, params: [] };
  if (tabName === 'Dibatalkan') return { sql: `${column} <= 0`, params: [] };
  if (tabName === 'Antrean' || tabName === 'Diterima') {
    return { sql: `${column} > 0 AND ${column} <= 17.5`, params: [] };
  }
  if (tabName === 'Pencucian' || tabName === 'Proses Cuci') {
    return { sql: `${column} > 17.5 AND ${column} <= 37.5`, params: [] };
  }
  if (tabName === 'Penyetrikaan' || tabName === 'Proses Setrika') {
    return { sql: `${column} > 37.5 AND ${column} <= 62.5`, params: [] };
  }
  if (tabName === 'Pengemasan' || tabName === 'Proses Packing') {
    return { sql: `${column} > 62.5 AND ${column} <= 82.5`, params: [] };
  }
  if (
    tabName === 'Siap Diambil / Diantar' ||
    tabName === 'Siap Diambil' ||
    tabName === 'Siap Diantar' ||
    tabName === 'Delivery'
  ) {
    return { sql: `${column} > 82.5 AND ${column} < 100`, params: [] };
  }
  if (tabName === 'Selesai') return { sql: `${column} >= 100`, params: [] };
  return { sql: '1=1', params: [] };
}
