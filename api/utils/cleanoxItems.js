/**
 * Phase 17 — Cleanox By Waschen: satu baris tr_cleanox_by_waschen = satu barang fisik.
 * Dipakai createTransaction (POS) dan agent/migrateCleanoxByWaschen.js.
 */

/** Satuan ukuran (berat/luas/panjang): qty = ukuran satu barang, bukan jumlah barang. */
const MEASURE_UNITS = new Set(['kg', 'm²', 'm2', 'cm²', 'cm2', 'cm', 'm', 'meter']);

/** Pengaman salah ketik qty (mis. 1000 Pcs) agar tidak membuat ribuan baris. */
export const MAX_CLEANOX_ITEMS_PER_LINE = 200;

/**
 * Jumlah barang fisik dalam satu baris detail.
 * PCS/Pasang/Stel qty bulat 3 -> 3; Kg/m² atau qty pecahan -> 1.
 */
export function cleanoxItemCount(unit, qty) {
  const q = Number(qty);
  if (MEASURE_UNITS.has(String(unit || '').trim().toLowerCase())) return 1;
  if (!Number.isInteger(q) || q < 1) return 1;
  return Math.min(q, MAX_CLEANOX_ITEMS_PER_LINE);
}

const CLEANOX_LIST_COLUMNS = `id, transaction_detail_id, item_ke, service_name, unit, qty, status,
  qc_frontliner_at, pickup_by, pickup_at, cuci_jemur_by, cuci_jemur_at, cuci_jemur_deadline_at,
  packing_by, packing_at, pengantaran_by, pengantaran_at,
  pickup_photo_path, cuci_jemur_photo_path, packing_photo_path, pengantaran_photo_path,
  on_hold, hold_by, hold_at, is_continue, continue_by, continue_at, continue_note, cleanox_note,
  source, updated_by, updated_at`;

/** Item Cleanox satu nota untuk rincian Riwayat POS. Tabel belum dimigrasi -> []. */
export async function getCleanoxItemsByTransaction(db, transactionId) {
  try {
    const [rows] = await db.query(
      `SELECT ${CLEANOX_LIST_COLUMNS} FROM tr_cleanox_by_waschen
       WHERE transaction_id = ? ORDER BY transaction_detail_id, item_ke, id`,
      [transactionId]
    );
    return rows;
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return [];
    throw err;
  }
}

/** Badge daftar Riwayat: cleanox_hold_count = item Cleanox yang menunggu keputusan frontliner. */
export async function attachCleanoxHoldCount(db, rows) {
  for (const r of rows) r.cleanox_hold_count = 0;
  const ids = rows.map((r) => r.id).filter(Boolean);
  if (!ids.length) return;
  try {
    const [holds] = await db.query(
      `SELECT transaction_id, COUNT(*) n FROM tr_cleanox_by_waschen
       WHERE on_hold = 1 AND transaction_id IN (?) GROUP BY transaction_id`,
      [ids]
    );
    const byId = new Map(holds.map((h) => [h.transaction_id, Number(h.n)]));
    for (const r of rows) r.cleanox_hold_count = byId.get(r.id) || 0;
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
  }
}

/**
 * Baris tr_cleanox_by_waschen untuk item baru dari POS (dalam transaksi DB pemanggil).
 * @param {import('mysql2/promise').PoolConnection} connection
 */
export async function insertCleanoxItemsForDetail(connection, { transactionId, detailId, orderNo, outletId, outletName, customer, serviceName, unit, qty, subtotal, receivedAt }) {
  const count = cleanoxItemCount(unit, qty);
  const rows = [];
  for (let i = 1; i <= count; i += 1) {
    rows.push([
      transactionId, detailId, i, orderNo, outletId || null, outletName || null,
      customer?.id || null, customer?.name || null, customer?.phone || null, customer?.address || null,
      serviceName, unit || null, Number(qty) || 1, Number(subtotal) || 0, receivedAt, 'POS'
    ]);
  }
  try {
    await connection.query(
      `INSERT INTO tr_cleanox_by_waschen
         (transaction_id, transaction_detail_id, item_ke, order_no, outlet_id, outlet_name,
          customer_id, customer_name, customer_phone, customer_address,
          service_name, unit, qty, subtotal, received_at, source)
       VALUES ?`,
      [rows]
    );
  } catch (err) {
    // Kode terdeploy sebelum agent/migrate_phase17_cleanox.sql: nota tetap tersimpan (is_cleanox di detail).
    if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
    console.warn(`[CLEANOX] tabel tr_cleanox_by_waschen belum ada; ${orderNo} detail ${detailId} tidak masuk antrean Cleanox`);
    return 0;
  }
  return count;
}
