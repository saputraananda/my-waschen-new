import { mainPool } from '../db/pool.js';

const FALLBACK_NAME = /^(Kasir|Karyawan) #\d+$/;

/**
 * Nama karyawan dari mst_employee (DB utama). Dipakai untuk Manajemen, yang tidak ada di mst_role.
 * Mengembalikan Map<employeeId, fullName>.
 */
export async function getEmployeeNames(ids) {
  const uniq = [...new Set((ids || []).map((n) => Number(n)).filter(Boolean))];
  const map = new Map();
  if (!uniq.length) return map;
  try {
    const [rows] = await mainPool.query(
      'SELECT employee_id, full_name FROM mst_employee WHERE employee_id IN (?)',
      [uniq]
    );
    rows.forEach((r) => {
      const name = String(r.full_name || '').trim();
      if (name) map.set(Number(r.employee_id), name);
    });
  } catch (err) {
    console.warn('getEmployeeNames:', err.message);
  }
  return map;
}

/**
 * Baris yang namanya masih fallback ("Kasir #12" / "Karyawan #12", karena tidak ada di mst_role)
 * diganti nama dari mst_employee. Mengubah rows in-place.
 */
export async function fillFallbackNames(rows, idKey, nameKey) {
  const list = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
  const pending = list.filter((r) => r[idKey] && FALLBACK_NAME.test(String(r[nameKey] || '')));
  if (!pending.length) return rows;
  const names = await getEmployeeNames(pending.map((r) => r[idKey]));
  pending.forEach((r) => {
    const name = names.get(Number(r[idKey]));
    if (name) r[nameKey] = name;
  });
  return rows;
}
