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
  'activeOutletName',
  'eventOutlet', // kunci lama (satu event), dibersihkan saat logout
  'eventOutlets',
  'homeOutletId',
  'homeOutletName'
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

export const DELIVERY_ROLE = 'Delivery Staff';

/** Delivery buat nota di rumah customer, jadi tidak wajib open shift. */
export function isDeliveryStaff() {
  return localStorage.getItem('activeRole') === DELIVERY_ROLE;
}

/**
 * Karyawan outlet Waschen (company_id = 5) wajib buka shift sebelum akses menu POS.
 * Delivery dikecualikan — notanya diklaim frontliner saat open shift berikutnya.
 */
export function requiresShiftGate() {
  return localStorage.getItem('companyId') === '5' && !isDeliveryStaff() && !isEventOutletActive();
}

/**
 * Semua outlet virtual Event dari login (bisa lebih dari satu, mis. Haji & Umroh bersamaan).
 * Tiap item: { id, name, full_name, active } — active = event sedang berjalan.
 */
export function getEventOutlets() {
  try {
    const raw = JSON.parse(localStorage.getItem('eventOutlets') || 'null');
    if (Array.isArray(raw)) return raw.filter((ev) => ev && ev.id);
    // Sesi login lama (sebelum multi event) hanya menyimpan satu 'eventOutlet'
    const legacy = JSON.parse(localStorage.getItem('eventOutlet') || 'null');
    return legacy && legacy.id ? [{ ...legacy, active: true }] : [];
  } catch {
    return [];
  }
}

/** Event yang sedang berjalan — pilihan outlet kerja staf di header. */
export function getActiveEventOutlets() {
  return getEventOutlets().filter((ev) => ev.active !== false);
}

/** Menu Distribusi Event: Manajemen (jika ada event), atau staf yang sedang bertugas di outlet Event. */
export function canUseEventDistribution() {
  if (localStorage.getItem('companyId') === '1') return getEventOutlets().length > 0;
  return isEventOutletActive();
}

/** True bila id outlet tertentu adalah outlet Event (aktif maupun sudah selesai). */
export function isEventOutletId(outletId) {
  return getEventOutlets().some((ev) => String(ev.id) === String(outletId));
}

/** True bila outlet yang sedang aktif adalah outlet Event (tanpa shift). */
export function isEventOutletActive() {
  return isEventOutletId(localStorage.getItem('activeOutletId'));
}

export function getCompanyId() {
  return localStorage.getItem('companyId') || '';
}
