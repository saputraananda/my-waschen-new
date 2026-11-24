import { mainPool, myWaschenPool } from '../db/pool.js';

/**
 * Peta employee_id → nama. Utamakan mst_role (staf Waschen); id yang tidak ada di sana
 * (mis. Manajemen yang buka shift) diambil dari mst_employee. Kunci number dan string sama-sama terisi.
 */
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
    const missing = ids.filter((id) => !map[id]);
    if (missing.length) {
      try {
        const [empRows] = await mainPool.query(
          'SELECT employee_id, full_name FROM mst_employee WHERE employee_id IN (?)',
          [missing]
        );
        for (const r of empRows) {
          const name = String(r.full_name || '').trim();
          if (!name) continue;
          const id = Number(r.employee_id);
          map[id] = name;
          map[String(id)] = name;
        }
      } catch (err) {
        console.error('getEmployeeNames (mst_employee):', err.message);
      }
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
