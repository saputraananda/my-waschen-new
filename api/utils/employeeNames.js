import { myWaschenPool } from '../db/pool.js';

/** Peta employee_id → nama (dari mst_role). Kunci number dan string sama-sama terisi. */
export const getEmployeeNames = async (employeeIds = []) => {
  const ids = [...new Set(employeeIds.filter(Boolean).map(Number))];
  if (!ids.length) return {};
  try {
    const [roleRows] = await myWaschenPool.query(
      `SELECT employee_id, employee_name FROM mst_role
       WHERE employee_id IN (${ids.map(() => '?').join(',')})
         AND employee_name IS NOT NULL AND TRIM(employee_name) != ''`,
      ids
    );
    const map = {};
    for (const r of roleRows) {
      const id = Number(r.employee_id);
      map[id] = r.employee_name;
      map[String(id)] = r.employee_name;
    }
    return map;
  } catch (err) {
    console.error('getEmployeeNames:', err.message);
    return {};
  }
};

export const formatEmployeeLabel = (employeeId, nameMap, fallback = 'Kasir') => {
  const name = nameMap[employeeId];
  if (name) return name;
  return employeeId ? `Karyawan #${employeeId}` : fallback;
};
