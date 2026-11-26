import { myWaschenPool } from '../db/pool.js';

/**
 * Log login POS & "Masuk Shift" (tabel tr_pos_login_log, agent/migrate_pos_login_log.sql).
 * Best-effort: kegagalan log tidak boleh menggagalkan login / shift.
 */
export async function insertPosLoginLog(req, {
  event = 'Login',
  employeeId = null,
  userId = null,
  employeeName = null,
  role = null,
  outletId = null,
  shiftId = null
} = {}) {
  try {
    const fwd = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = (fwd || req?.ip || req?.socket?.remoteAddress || '').slice(0, 64) || null;
    const ua = String(req?.headers?.['user-agent'] || '').slice(0, 255) || null;
    await myWaschenPool.query(
      `INSERT INTO tr_pos_login_log
       (event, employee_id, user_id, employee_name, role, outlet_id, shift_id, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [event, employeeId || null, userId || null, employeeName ? String(employeeName).slice(0, 150) : null,
        role ? String(role).slice(0, 50) : null, outletId || null, shiftId || null, ip, ua]
    );
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') console.error('insertPosLoginLog:', err.message);
  }
}
