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
  'dropPointOutlets',
  'eventStandOutlets',
  'outletFlags',
  // Kunci lama sebelum rename Event -> Drop Point, tetap dibersihkan saat logout
  'eventOutlet',
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
 * Karyawan outlet Waschen (company_id = 5) wajib buka shift sebelum akses menu POS,
 * kecuali outlet aktif diset tanpa shift (mst_outlet.requires_shift = 0, diatur admin di SuperApp).
 * Delivery dikecualikan — notanya diklaim frontliner saat open shift berikutnya.
 */
export function requiresShiftGate() {
  return localStorage.getItem('companyId') === '5' && !isDeliveryStaff() && activeOutletRequiresShift();
}

/**
 * Delivery & Manajemen tidak wajib shift, tapi tetap melihat badge shift dan BOLEH open/close shift
 * (sebagian kurir memang bisa menjalankan shift). Daily Worker tidak termasuk — dia wajib shift.
 */
export function allowsOptionalShift() {
  const companyId = localStorage.getItem('companyId');
  const optionalRole = companyId === '1' || (companyId === '5' && isDeliveryStaff());
  return optionalRole && activeOutletRequiresShift();
}

function normalizeFlags(o) {
  return {
    is_drop_point: Number(o?.is_drop_point) === 1 ? 1 : 0,
    is_event: Number(o?.is_event) === 1 ? 1 : 0,
    is_active: o?.is_active === undefined ? (o?.active === false ? 0 : 1) : (Number(o.is_active) === 1 ? 1 : 0),
    requires_shift: o?.requires_shift === undefined || o?.requires_shift === null ? 1 : (Number(o.requires_shift) === 1 ? 1 : 0)
  };
}

/**
 * Simpan flag outlet dari respons login: map { [outletId]: { is_drop_point, is_active, requires_shift } }
 * dari daftar outlets, dropPointOutlets, dan outlet asal staf.
 */
export function storeOutletFlags({ outlets = [], dropPointOutlets = [], eventOutlets = [], assignedOutletId = null, assignedOutletFlags = null } = {}) {
  const map = {};
  [
    ...(Array.isArray(outlets) ? outlets : []),
    ...(Array.isArray(dropPointOutlets) ? dropPointOutlets : []),
    ...(Array.isArray(eventOutlets) ? eventOutlets : [])
  ].forEach((o) => {
    if (o && o.id) map[String(o.id)] = normalizeFlags(o);
  });
  if (assignedOutletId && assignedOutletFlags) {
    map[String(assignedOutletId)] = normalizeFlags(assignedOutletFlags);
  }
  localStorage.setItem('outletFlags', JSON.stringify(map));
}

/**
 * Terapkan perubahan outlet dari Super App (event socket 'outlet:updated') ke data sesi:
 * peta outletFlags + daftar Drop Point (status aktif / wajib shift). Mengembalikan true
 * bila outlet itu relevan untuk sesi ini (outlet aktif, asal, atau drop point yang dikenal).
 */
export function applyOutletUpdate(outlet) {
  if (!outlet || !outlet.id) return false;
  const key = String(outlet.id);
  const flags = normalizeFlags(outlet);
  let map = {};
  try { map = JSON.parse(localStorage.getItem('outletFlags') || '{}') || {}; } catch { map = {}; }
  const known = Boolean(map[key]);
  map[key] = flags;
  localStorage.setItem('outletFlags', JSON.stringify(map));

  let inDropPoints = false;
  try {
    const raw = JSON.parse(localStorage.getItem('dropPointOutlets') || 'null');
    if (Array.isArray(raw)) {
      const next = raw.map((dp) => {
        if (String(dp?.id) !== key) return dp;
        inDropPoints = true;
        return { ...dp, active: flags.is_active === 1, requires_shift: flags.requires_shift, is_active: flags.is_active };
      });
      if (inDropPoints) localStorage.setItem('dropPointOutlets', JSON.stringify(next));
    }
  } catch { /* abaikan */ }

  // Daftar outlet event (pilihan outlet staf): tambah / hapus / perbarui sesuai is_event
  let inEvents = false;
  try {
    const list = getEventOutlets();
    inEvents = list.some((o) => String(o.id) === key);
    const rest = list.filter((o) => String(o.id) !== key);
    const next = flags.is_event === 1
      ? [...rest, { id: outlet.id, name: outlet.name, full_name: outlet.full_name, ...flags, active: flags.is_active === 1 }]
      : rest;
    localStorage.setItem('eventStandOutlets', JSON.stringify(next));
    inEvents = inEvents || flags.is_event === 1;
  } catch { /* abaikan */ }

  return known || inDropPoints || inEvents
    || key === String(localStorage.getItem('activeOutletId'))
    || key === String(localStorage.getItem('homeOutletId'));
}

/** Flag outlet tertentu, atau null bila tidak diketahui. */
export function getOutletFlags(outletId) {
  if (!outletId) return null;
  try {
    const map = JSON.parse(localStorage.getItem('outletFlags') || '{}');
    const hit = map && map[String(outletId)];
    if (hit) return hit;
  } catch {
    // ignore
  }
  const dp = getDropPointOutlets().find((o) => String(o.id) === String(outletId));
  return dp && dp.requires_shift !== undefined ? normalizeFlags(dp) : null;
}

/** True bila outlet aktif wajib shift (mst_outlet.requires_shift). Default true bila tidak diketahui. */
export function activeOutletRequiresShift() {
  const flags = getOutletFlags(localStorage.getItem('activeOutletId'));
  return flags ? flags.requires_shift === 1 : true;
}

/**
 * Semua outlet Drop Point dari login (bisa lebih dari satu, aktif bersamaan).
 * Tiap item: { id, name, full_name, active } — active = drop point sedang aktif (mst_outlet.is_active).
 */
export function getDropPointOutlets() {
  try {
    const raw = JSON.parse(localStorage.getItem('dropPointOutlets') || 'null');
    if (Array.isArray(raw)) return raw.filter((dp) => dp && dp.id);
    // Sesi login sebelum rename Event -> Drop Point masih menyimpan 'eventOutlets'
    const old = JSON.parse(localStorage.getItem('eventOutlets') || 'null');
    if (Array.isArray(old)) return old.filter((dp) => dp && dp.id);
    // Sesi login paling lama hanya menyimpan satu 'eventOutlet'
    const legacy = JSON.parse(localStorage.getItem('eventOutlet') || 'null');
    return legacy && legacy.id ? [{ ...legacy, active: true }] : [];
  } catch {
    return [];
  }
}

/** Outlet Event (mst_outlet.is_event) dari login — stand event yang boleh dipilih semua staf. */
export function getEventOutlets() {
  try {
    const raw = JSON.parse(localStorage.getItem('eventStandOutlets') || '[]');
    return Array.isArray(raw) ? raw.filter((o) => o && o.id) : [];
  } catch {
    return [];
  }
}

/** Outlet Event yang aktif — pilihan outlet kerja staf di header (selain outlet asal). */
export function getActiveEventOutlets() {
  return getEventOutlets().filter((o) => o.active !== false && Number(o.is_active) !== 0);
}

/** Drop Point yang sedang aktif. */
export function getActiveDropPointOutlets() {
  return getDropPointOutlets().filter((dp) => dp.active !== false);
}

/** Menu Distribusi Drop Point: Manajemen (jika ada drop point), atau staf yang sedang bertugas di outlet Drop Point. */
export function canUseDropPointDistribution() {
  if (localStorage.getItem('companyId') === '1') return getDropPointOutlets().length > 0;
  return isDropPointOutletActive();
}

/** True bila id outlet tertentu adalah outlet Drop Point (aktif maupun tidak). */
export function isDropPointOutletId(outletId) {
  return getDropPointOutlets().some((dp) => String(dp.id) === String(outletId));
}

/** True bila outlet yang sedang aktif adalah outlet Drop Point. */
export function isDropPointOutletActive() {
  return isDropPointOutletId(localStorage.getItem('activeOutletId'));
}

export function getCompanyId() {
  return localStorage.getItem('companyId') || '';
}
