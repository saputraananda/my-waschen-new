import { mainPool } from '../db/pool.js';

/**
 * PIN karyawan (4 digit, unik) — tabel mst_employee_pin di DB utama (waschen).
 * Dipakai bersama SuperApp, Waschen Mobile, dan IKM Mobile.
 */
export const cleanPin = (value) => String(value ?? '').replace(/\D/g, '');

/** employee_id pemilik PIN, atau null. */
export async function findEmployeeIdByPin(pin) {
  const [rows] = await mainPool.query(
    'SELECT employee_id FROM mst_employee_pin WHERE pin = ? LIMIT 1',
    [pin]
  );
  return rows.length ? Number(rows[0].employee_id) : null;
}
