import { mainPool } from '../db/pool.js';

/**
 * Kasir yang dicatat harus karyawan yang sah. Alur PIN memang boleh mengganti kasir di
 * perangkat bersama, jadi id boleh berbeda dari akun login, tapi wajib: akun login itu sendiri
 * atau karyawan terdaftar di mst_role.
 * Mengembalikan id kasir valid, atau null.
 */
export async function resolveValidCashier(connection, req, cashierEmployeeId) {
  const loginId = Number(req.auth?.employeeId) || null;
  const requested = Number(cashierEmployeeId) || null;
  if (!requested) return loginId;
  if (requested === loginId) return requested;
  const [rows] = await connection.query(
    'SELECT employee_id FROM mst_role WHERE employee_id = ? LIMIT 1',
    [requested]
  );
  return rows.length ? requested : null;
}

/** Perusahaan HQ (company_id = 1) = penyetuju kas kecil. Token lama tanpa companyId dicek ke DB. */
export async function isHqApprover(req) {
  if (req.auth?.companyId != null) return Number(req.auth.companyId) === 1;
  const employeeId = Number(req.auth?.employeeId) || null;
  if (!employeeId) return false;
  const [rows] = await mainPool.query(
    'SELECT company_id FROM mst_employee WHERE employee_id = ? LIMIT 1',
    [employeeId]
  );
  return Number(rows[0]?.company_id) === 1;
}
