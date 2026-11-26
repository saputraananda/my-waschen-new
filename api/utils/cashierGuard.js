import { mainPool } from '../db/pool.js';
import { getManagementEmployee } from './employeePin.js';

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
  if (rows.length) return requested;
  // Manajemen (company_id = 1) juga boleh jadi kasir lewat PIN
  return (await getManagementEmployee(requested)) ? requested : null;
}

/**
 * Shift opsional untuk semua selain Frontliner: Manajemen (company_id = 1, tanpa mst_role),
 * Delivery, Daily Worker, staf produksi. Nota / pelunasan mereka tanpa shift terbuka
 * jadi tanggung jawab shift outlet berikutnya. Role kosong diperlakukan seperti Frontliner.
 */
export async function isShiftOptionalCashier(connection, employeeId) {
  const id = Number(employeeId) || null;
  if (!id) return false;
  const [rows] = await connection.query('SELECT role FROM mst_role WHERE employee_id = ? LIMIT 1', [id]);
  if (rows.length) {
    const role = String(rows[0].role || '').trim();
    return role !== '' && role !== 'Frontliner';
  }
  return Boolean(await getManagementEmployee(id));
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
