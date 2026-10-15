import { myWaschenPool } from '../db/pool.js';

/** Event dianggap berjalan: event_active = 1 dan hari ini di dalam rentang tanggal (jika diisi). */
const EVENT_OPEN_SQL = `(COALESCE(event_active, 0) = 1
  AND (event_start IS NULL OR event_start <= CURDATE())
  AND (event_end IS NULL OR event_end >= CURDATE()))`;

const isMissingColumn = (err) => /Unknown column/i.test(err?.message || '');

/**
 * True jika outlet adalah outlet virtual event (mst_outlet.is_event = 1), aktif maupun sudah selesai.
 * Aman dipanggil sebelum migrasi event dijalankan (kolom belum ada -> false).
 */
export async function isEventOutlet(outletId, conn = myWaschenPool) {
  const id = Number(outletId);
  if (!id) return false;
  try {
    const [rows] = await conn.query('SELECT is_event FROM mst_outlet WHERE id = ? LIMIT 1', [id]);
    return Number(rows[0]?.is_event) === 1;
  } catch (err) {
    if (isMissingColumn(err)) return false;
    throw err;
  }
}

/** True jika outlet event sedang berjalan (boleh membuat nota baru). */
export async function isEventOutletOpen(outletId, conn = myWaschenPool) {
  const id = Number(outletId);
  if (!id) return false;
  try {
    const [rows] = await conn.query(
      `SELECT ${EVENT_OPEN_SQL} AS is_open FROM mst_outlet WHERE id = ? AND is_event = 1 LIMIT 1`,
      [id]
    );
    return Number(rows[0]?.is_open) === 1;
  } catch (err) {
    // Sebelum migrate_event_multi.sql: semua outlet event dianggap berjalan
    if (isMissingColumn(err)) return isEventOutlet(id, conn);
    throw err;
  }
}

/**
 * Semua outlet event (terbaru dulu) beserta flag `active`.
 * Beberapa event boleh berjalan bersamaan.
 */
export async function listEventOutlets(conn = myWaschenPool) {
  try {
    const [rows] = await conn.query(
      `SELECT id, name, full_name, event_start, event_end, ${EVENT_OPEN_SQL} AS active
       FROM mst_outlet WHERE is_event = 1 ORDER BY active DESC, id DESC`
    );
    return rows.map((r) => ({ ...r, active: Number(r.active) === 1 }));
  } catch (err) {
    if (!isMissingColumn(err)) throw err;
  }
  // Fallback sebelum migrate_event_multi.sql
  try {
    const [rows] = await conn.query(
      'SELECT id, name, full_name FROM mst_outlet WHERE is_event = 1 ORDER BY id DESC'
    );
    return rows.map((r) => ({ ...r, event_start: null, event_end: null, active: true }));
  } catch (err) {
    if (isMissingColumn(err)) return [];
    throw err;
  }
}
