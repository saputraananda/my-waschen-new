/**
 * Layanan per outlet (Phase 18).
 * mst_service        = master/induk.
 * mst_service_outlet = layanan yang tersedia di outlet; kolom override NULL = ikut master.
 * Tidak ada baris (atau is_active = 0) = layanan tidak tersedia di outlet tersebut.
 */

/** Kolom nilai efektif (override outlet, jika kosong pakai master). Butuh alias `s` dan `so`. */
export const EFFECTIVE_SERVICE_COLUMNS = `
  s.id, s.code, s.description, s.is_cleanox, s.is_featured, s.is_dc_required, s.is_active,
  s.created_at, s.updated_at,
  COALESCE(so.name, s.name) AS name,
  COALESCE(so.category_id, s.category_id) AS category_id,
  COALESCE(so.unit_id, s.unit_id) AS unit_id,
  COALESCE(so.price, s.price) AS price,
  COALESCE(so.regular_duration_days, s.regular_duration_days) AS regular_duration_days,
  COALESCE(so.min_order_qty, s.min_order_qty) AS min_order_qty,
  COALESCE(so.dc_price_add, s.dc_price_add) AS dc_price_add`;

/** Teks satuan efektif. Butuh alias `s`, `so`, dan `u` (mst_unit). */
export const EFFECTIVE_UNIT_SQL = `COALESCE(so.unit, s.unit, u.symbol, u.code, 'Kg')`;

/** Kategori efektif (untuk JOIN mst_service_category). */
export const EFFECTIVE_CATEGORY_ID_SQL = 'COALESCE(so.category_id, s.category_id)';

/** Syarat layanan tersedia di outlet (dipakai bersama JOIN/LEFT JOIN mst_service_outlet so). */
export const AVAILABLE_SQL = '(so.id IS NOT NULL AND so.is_active = 1 AND s.is_active = 1)';
