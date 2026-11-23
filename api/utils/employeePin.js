import { mainPool } from '../db/pool.js';

/**
 * PIN karyawan (4 digit, unik) — tabel mst_employee_pin di DB utama (waschen).
 * Dipakai bersama SuperApp, Waschen Mobile, dan IKM Mobile.
 */
export const cleanPin = (value) => String(value ?? '').replace(/\D/g, '');

/** Karyawan Manajemen (company_id = 1, aktif) — boleh jadi kasir nota/pelunasan seperti staf Waschen. */
export async function getManagementEmployee(employeeId) {
  const [rows] = await mainPool.query(
    `SELECT employee_id, full_name FROM mst_employee
     WHERE employee_id = ? AND company_id = 1 AND COALESCE(is_deleted, 0) = 0 AND exit_date IS NULL
     LIMIT 1`,
    [employeeId]
  );
  return rows[0] || null;
}

/** employee_id pemilik PIN, atau null. */
export async function findEmployeeIdByPin(pin) {
  const [rows] = await mainPool.query(
    'SELECT employee_id FROM mst_employee_pin WHERE pin = ? LIMIT 1',
    [pin]
  );
  return rows.length ? Number(rows[0].employee_id) : null;
}
