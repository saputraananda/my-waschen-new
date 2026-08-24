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
  'activeShiftOpenedAt'
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
  sessionStorage.removeItem('shiftSessionConfirmed');
}

export function markShiftSessionConfirmed(shiftId) {
  sessionStorage.setItem('shiftSessionConfirmed', String(shiftId));
}

export function isShiftSessionConfirmed(shiftId) {
  return sessionStorage.getItem('shiftSessionConfirmed') === String(shiftId);
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
