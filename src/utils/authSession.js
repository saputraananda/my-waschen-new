const AUTH_KEYS = [
  'token',
  'employeeId',
  'username',
  'fullName',
  'profilePath',
  'companyId',
  'activeRole',
  'outlets',
  'activeOutletId',
  'activeOutletName'
];

const SHIFT_KEYS = [
  'activeShiftId',
  'shiftNumber',
  'activeShiftOpenedAt',
  'shiftSessionConfirmed'
];

export function syncShiftToStorage(shift) {
  if (!shift?.id) return;
  localStorage.setItem('activeShiftId', String(shift.id));
  localStorage.setItem('shiftNumber', String(shift.shift_number));
  if (shift.opened_at) {
    localStorage.setItem('activeShiftOpenedAt', shift.opened_at);
  }
}

export function clearShiftFromStorage() {
  SHIFT_KEYS.forEach((key) => localStorage.removeItem(key));
  try {
    sessionStorage.removeItem('shiftSessionConfirmed');
  } catch (e) {
    // ignore
  }
}

export function markShiftSessionConfirmed(shiftId) {
  if (!shiftId) return;
  localStorage.setItem('shiftSessionConfirmed', String(shiftId));
  try {
    sessionStorage.setItem('shiftSessionConfirmed', String(shiftId));
  } catch (e) {
    // ignore
  }
}

export function isShiftSessionConfirmed(shiftId) {
  if (!shiftId) return false;
  const targetId = String(shiftId);
  let sessionConfirmed = null;
  try {
    sessionConfirmed = sessionStorage.getItem('shiftSessionConfirmed');
  } catch (e) {
    // ignore
  }

  return (
    localStorage.getItem('shiftSessionConfirmed') === targetId ||
    sessionConfirmed === targetId ||
    localStorage.getItem('activeShiftId') === targetId
  );
}

/** Logout sesi user — shift outlet tetap Open di database. */
export function logoutSession() {
  AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
  clearShiftFromStorage();
}

/** Logout penuh setelah closing shift (shift sudah Closed di server). */
export function logoutAfterClose() {
  logoutSession();
}

export function getLoggedInEmployeeId() {
  const id = localStorage.getItem('employeeId');
  return id ? parseInt(id, 10) : null;
}

export function isHqUser() {
  return localStorage.getItem('companyId') === '1';
}

/** Karyawan outlet Waschen (company_id = 5) wajib buka shift sebelum akses menu POS. */
export function requiresShiftGate() {
  return localStorage.getItem('companyId') === '5';
}

export function getCompanyId() {
  return localStorage.getItem('companyId') || '';
}
