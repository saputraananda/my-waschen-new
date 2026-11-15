import { myWaschenPool } from '../db/pool.js';

/**
 * Drop Point = outlet biasa (mst_outlet.is_drop_point = 1) yang terutama menerima cucian.
 * Item notanya boleh didistribusikan ke outlet lain untuk produksi/QC
 * (tr_transaction_detail.production_outlet_id); bila tidak, dikerjakan di drop point itu sendiri.
 */

/** True jika outlet adalah outlet Drop Point (aktif maupun tidak). */
export async function isDropPointOutlet(outletId, conn = myWaschenPool) {
  const flags = await getOutletFlags(outletId, conn);
  return flags.is_drop_point === 1;
}

/**
 * True jika outlet aktif (mst_outlet.is_active = 1). Berlaku untuk semua outlet.
 * Outlet tidak aktif tidak boleh membuat nota baru.
 */
export async function isOutletActive(outletId, conn = myWaschenPool) {
  const flags = await getOutletFlags(outletId, conn);
  return flags.is_active === 1;
}

/**
 * Flag outlet: { exists, is_drop_point, is_active, requires_shift } (0/1).
 * requires_shift = 1: staf wajib open shift sebelum transaksi (diatur admin di SuperApp).
 * Outlet tidak ditemukan → exists=false, semua flag 0 kecuali requires_shift=1 (paling aman).
 */
export async function getOutletFlags(outletId, conn = myWaschenPool) {
  const id = Number(outletId);
  if (!id) return { exists: false, is_drop_point: 0, is_active: 0, requires_shift: 1 };
  const [rows] = await conn.query(
    `SELECT COALESCE(is_drop_point, 0) AS is_drop_point,
            COALESCE(is_active, 0) AS is_active,
            COALESCE(requires_shift, 1) AS requires_shift
     FROM mst_outlet WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return { exists: false, is_drop_point: 0, is_active: 0, requires_shift: 1 };
  return {
    exists: true,
    is_drop_point: Number(rows[0].is_drop_point) === 1 ? 1 : 0,
    is_active: Number(rows[0].is_active) === 1 ? 1 : 0,
    requires_shift: Number(rows[0].requires_shift) === 1 ? 1 : 0
  };
}

/**
 * Semua outlet Drop Point (aktif dulu, terbaru dulu) beserta flag `active` (dari is_active)
 * dan is_drop_point / is_active / requires_shift. Beberapa Drop Point boleh aktif bersamaan.
 */
export async function listDropPointOutlets(conn = myWaschenPool) {
  const [rows] = await conn.query(
    `SELECT id, name, full_name,
            (COALESCE(is_active, 0) = 1) AS active,
            COALESCE(is_drop_point, 0) AS is_drop_point,
            COALESCE(is_active, 0) AS is_active,
            COALESCE(requires_shift, 1) AS requires_shift
     FROM mst_outlet WHERE is_drop_point = 1 ORDER BY active DESC, id DESC`
  );
  return rows.map((r) => ({
    ...r,
    active: Number(r.active) === 1,
    is_drop_point: Number(r.is_drop_point),
    is_active: Number(r.is_active),
    requires_shift: Number(r.requires_shift)
  }));
}
