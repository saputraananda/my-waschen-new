import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import OpenShiftModal from '../pages/Shift/OpenShiftModal.jsx';
import CloseShiftModal from '../pages/Shift/CloseShiftModal.jsx';
import ResumeShiftModal from '../pages/Shift/ResumeShiftModal.jsx';
import { getSocket } from '../utils/socket.js';
import {
  allowsOptionalShift,
  applyOutletUpdate,
  clearShiftFromStorage,
  getLoggedInEmployeeId,
  isHqUser,
  isShiftSessionConfirmed,
  markShiftSessionConfirmed,
  requiresShiftGate,
  syncShiftToStorage
} from '../utils/authSession.js';

const ShiftContext = createContext(null);

/**
 * Tanpa shift terbuka semua halaman tetap bisa DIBUKA (mode lihat saja), kecuali Order Baru.
 * Aksi yang mengubah data dikunci oleh penjaga axios di bawah.
 */
function isShiftFreePath(pathname) {
  if (!pathname) return false;
  return !(pathname === '/transaction' || pathname.startsWith('/transaction/'));
}

/**
 * Request ubah data yang tetap boleh tanpa shift:
 * login/shift (buka, PIN, lanjut, tutup), Setoran Tunai (diunggah setelah close shift),
 * link nota digital (hanya berbagi), pengaturan printer, Distribusi Drop Point (outlet tanpa shift).
 */
const VIEW_ONLY_ALLOWED_WRITES = [
  /^\/api\/auth\//,
  /^\/api\/shifts(\/|$)/,
  /^\/api\/deposit-report(\/|$)/,
  /^\/api\/transactions\/[^/]+\/digital-nota-access$/,
  /^\/api\/printer-settings$/,
  /^\/api\/drop-point(\/|$)/,
];

export const VIEW_ONLY_MESSAGE = 'Shift belum dibuka. Halaman ini hanya bisa dilihat — buka shift untuk melakukan aksi.';

function isBlockedWrite(cfg) {
  const method = String(cfg?.method || 'get').toLowerCase();
  if (method === 'get' || method === 'head' || method === 'options') return false;
  const url = String(cfg?.url || '').split('?')[0];
  if (!url.startsWith('/api/')) return false;
  return !VIEW_ONLY_ALLOWED_WRITES.some((re) => re.test(url));
}

/** Hydrate shift dari localStorage agar UI tidak flash "Belum Open" saat API masih loading. */
function readOptimisticShift() {
  const id = localStorage.getItem('activeShiftId');
  if (!id) return null;
  const shiftNumber = parseInt(localStorage.getItem('shiftNumber') || '1', 10) || 1;
  const openedAt = localStorage.getItem('activeShiftOpenedAt') || null;
  const confirmed = isShiftSessionConfirmed(id);
  if (!confirmed) return null;
  return {
    id: parseInt(id, 10),
    shift_number: shiftNumber,
    status: 'Open',
    opened_at: openedAt,
    cashier_employee_id: getLoggedInEmployeeId(),
    opener_name: localStorage.getItem('fullName') || null,
    _optimistic: true
  };
}

export function ShiftProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === '/login';

  const [activeShift, setActiveShift] = useState(() => readOptimisticShift());
  const [shiftChecked, setShiftChecked] = useState(() => {
    // Jika ada shift terkonfirmasi di localStorage, UI langsung siap (API soft-confirm di background)
    if (!requiresShiftGate() || !localStorage.getItem('token')) return true;
    return Boolean(readOptimisticShift());
  });
  const [sessionReady, setSessionReady] = useState(() => Boolean(readOptimisticShift()));
  /** Shift terbuka di outlet aktif (hanya tampilan) untuk user tanpa gerbang shift, mis. Management/HQ. */
  const [outletShift, setOutletShift] = useState(null);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [pendingNavigatePath, setPendingNavigatePath] = useState(null);
  const [outletId, setOutletId] = useState(localStorage.getItem('activeOutletId') || '2');
  /** Reactive auth flags — di-sync setelah login / ganti route (localStorage tidak trigger re-render) */
  const [mustGateShift, setMustGateShift] = useState(() => requiresShiftGate());
  /** Delivery: shift opsional — badge & modal open/close tampil, tapi tidak mengunci apa pun. */
  const [optionalShift, setOptionalShift] = useState(() => allowsOptionalShift());
  const [hasToken, setHasToken] = useState(() => !!localStorage.getItem('token'));
  const [authEpoch, setAuthEpoch] = useState(0);

  const employeeId = getLoggedInEmployeeId();
  const isHq = isHqUser();

  const syncAuthFlags = useCallback((options = {}) => {
    const nextGate = requiresShiftGate();
    const nextOptional = allowsOptionalShift();
    const nextToken = !!localStorage.getItem('token');
    const oid = localStorage.getItem('activeOutletId');

    setMustGateShift((prev) => (prev === nextGate ? prev : nextGate));
    setOptionalShift((prev) => (prev === nextOptional ? prev : nextOptional));
    setHasToken((prev) => (prev === nextToken ? prev : nextToken));
    if (oid) {
      setOutletId((prev) => (String(prev) === String(oid) ? prev : oid));
    }

    // Hanya bump epoch jika auth benar-benar berubah (hindari refetch berulang)
    if (options.force || options.authChanged) {
      setAuthEpoch((n) => n + 1);
    }
  }, []);

  /**
   * Shift outlet sudah dibuka FL → akun apa pun yang login langsung ikut bekerja di shift itu
   * (tanpa konfirmasi "Lanjutkan"). Server mencatat "Masuk Shift" (log login + terakhir aktif).
   * Aksi nota / pelunasan tetap meminta PIN masing-masing.
   */
  const joinShiftSilently = useCallback((shift) => {
    if (!shift?.id) return;
    syncShiftToStorage(shift);
    markShiftSessionConfirmed(shift.id);
    setSessionReady(true);
    const empId = getLoggedInEmployeeId();
    if (!empId) return;
    axios.post(`/api/shifts/${shift.id}/resume`, { employeeId: empId }, { timeout: 15000 })
      .then((r) => { if (r.data?.success && r.data.data) setActiveShift(r.data.data); })
      .catch(() => {});
  }, []);

  const applyOpenShift = useCallback((shift) => {
    setActiveShift(shift);
    syncShiftToStorage(shift);
    markShiftSessionConfirmed(shift.id);
    setSessionReady(true);
    setShiftChecked(true);
    setIsOpenShiftModalOpen(false);
    setIsResumeModalOpen(false);

    setPendingNavigatePath((pending) => {
      if (pending) {
        navigate(pending);
      }
      return null;
    });
  }, [navigate]);

  /**
   * @param {string|number} oid
   * @param {{ soft?: boolean }} options soft=true: jangan blank-kan UI saat refetch
   */
  const fetchCurrentShift = useCallback(async (oid = outletId, options = {}) => {
    const soft = options.soft !== false; // default soft
    // Delivery (shift opsional) ikut melacak shift outlet seperti yang wajib, tanpa gerbang
    const gated = requiresShiftGate() || allowsOptionalShift();
    const token = !!localStorage.getItem('token');

    if (isLoginPage) {
      return;
    }

    if (!token) {
      setActiveShift(null);
      clearShiftFromStorage();
      setSessionReady(false);
      setShiftChecked(true);
      return;
    }

    if (!gated) {
      // Non-gated (outlet requires_shift = 0, HQ, Delivery): tidak ada shift; jangan tampilkan shift outlet sebelumnya
      setActiveShift(null);
      setShiftChecked(true);
      setSessionReady(true);
      // Tetap tampilkan status shift outlet (dibuka tim lain) di header; tidak memengaruhi gerbang/sesi.
      axios.get('/api/shifts/current', { params: { outlet_id: oid || 2 }, timeout: 15000 })
        .then((r) => setOutletShift(r.data?.success ? (r.data.data || null) : null))
        .catch(() => {});
      return;
    }
    setOutletShift(null);

    // Soft refresh: tetap tampilkan shift lama / optimistic — jangan flash "Belum Open"
    if (!soft) {
      setShiftChecked(false);
    }

    try {
      // Selama cek ini belum selesai, klik menu diabaikan: jangan biarkan menggantung
      const res = await axios.get('/api/shifts/current', {
        params: { outlet_id: oid || 2 },
        timeout: 15000
      });

      if (res.data?.success && res.data.data) {
        const shift = res.data.data;
        setActiveShift(shift);

        const currentEmpId = getLoggedInEmployeeId();
        const isSameOpener = Number(shift.cashier_employee_id) === Number(currentEmpId);
        const alreadyConfirmed = isShiftSessionConfirmed(shift.id);

        if (alreadyConfirmed || isSameOpener) {
          setSessionReady(true);
          syncShiftToStorage(shift);
          markShiftSessionConfirmed(shift.id);
        } else {
          // Akun lain di shift yang sedang berjalan: langsung masuk, tanpa modal "Lanjutkan"
          joinShiftSilently(shift);
        }
      } else {
        setActiveShift(null);
        clearShiftFromStorage();
        setSessionReady(false);
      }
    } catch (err) {
      console.error('Gagal cek shift:', err);
      // Soft: jangan hapus shift yang sudah tampil jika network error
      if (!soft) {
        setActiveShift(null);
        setSessionReady(false);
      }
    } finally {
      setShiftChecked(true);
    }
  }, [isLoginPage, outletId, joinShiftSilently]);

  useEffect(() => {
    // Sync outlet/token tanpa force refetch tiap ganti path
    syncAuthFlags();
  }, [location.pathname, syncAuthFlags]);

  useEffect(() => {
    if (isLoginPage || !hasToken) {
      setShiftChecked(true);
      return;
    }
    fetchCurrentShift(outletId, { soft: true });
  }, [fetchCurrentShift, hasToken, isLoginPage, outletId, authEpoch]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'activeOutletId' && e.newValue) {
        setOutletId(e.newValue);
      }
      if (e.key === 'token' || e.key === 'companyId') {
        syncAuthFlags({ authChanged: true });
      }
    };
    const onAuthChanged = () => syncAuthFlags({ authChanged: true });
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (isLoginPage || !localStorage.getItem('token')) return;
      // Soft refetch di background — UI tidak blank
      const oid = localStorage.getItem('activeOutletId') || outletId || '2';
      fetchCurrentShift(oid, { soft: true });
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('waschen:auth-changed', onAuthChanged);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('waschen:network-restored', onVisible);

    return () => {
      window.removeEventListener('waschen:network-restored', onVisible);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('waschen:auth-changed', onAuthChanged);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchCurrentShift, isLoginPage, outletId, syncAuthFlags]);

  // Admin ubah outlet di Super App (Wajib Shift / Aktif) → gerbang & badge shift menyesuaikan seketika
  useEffect(() => {
    if (isLoginPage || !hasToken) return undefined;
    const socket = getSocket();
    const onOutletUpdated = (payload) => {
      if (!applyOutletUpdate(payload?.outlet)) return;
      syncAuthFlags({ authChanged: true });
      window.dispatchEvent(new Event('waschen:outlet-flags-changed'));
    };
    // Shift ditutup otomatis sistem saat ganti hari → minta open shift baru
    const onShiftUpdated = (payload) => {
      if (payload?.action !== 'auto-close') return;
      const oid = localStorage.getItem('activeOutletId') || outletId || '2';
      if (payload.outletId && String(payload.outletId) !== String(oid)) return;
      fetchCurrentShift(oid, { soft: true });
    };
    socket.on('outlet:updated', onOutletUpdated);
    socket.on('shift:updated', onShiftUpdated);
    return () => {
      socket.off('outlet:updated', onOutletUpdated);
      socket.off('shift:updated', onShiftUpdated);
    };
  }, [fetchCurrentShift, hasToken, isLoginPage, outletId, syncAuthFlags]);

  const confirmResume = useCallback(async () => {
    if (!activeShift?.id || !employeeId) return;
    const res = await axios.post(`/api/shifts/${activeShift.id}/resume`, {
      employeeId
    });
    if (res.data?.success) {
      applyOpenShift(res.data.data);
    } else {
      throw new Error(res.data?.message || 'Gagal melanjutkan shift');
    }
  }, [activeShift?.id, applyOpenShift, employeeId]);

  const refreshShift = useCallback((options = {}) => {
    const oid = localStorage.getItem('activeOutletId') || outletId || '2';
    if (String(oid) !== String(outletId)) {
      setOutletId(oid);
    }
    return fetchCurrentShift(oid, { soft: options.soft !== false });
  }, [fetchCurrentShift, outletId]);

  const openCloseModal = useCallback(() => {
    setIsCloseShiftOpen(true);
  }, []);

  const requestOpenShift = useCallback(async (options = {}) => {
    if (options.thenNavigate) {
      setPendingNavigatePath(typeof options.thenNavigate === 'string' ? options.thenNavigate : '/transaction');
    }
    setIsOpenShiftModalOpen(true);
  }, []);

  /**
   * Guard navigasi menu: company_id=5 wajib shift terbuka.
   * company_id=1 (HQ) dan selain 5 bebas.
   * Belum open shift → tampilkan modal Open Shift.
   */
  const ensureShiftThenNavigate = useCallback((path = '/transaction') => {
    if (!mustGateShift) {
      navigate(path);
      return true;
    }
    if (!shiftChecked) return false;

    if (!activeShift) {
      void requestOpenShift({ thenNavigate: path });
      return false;
    }

    if (!isShiftSessionConfirmed(activeShift.id)) joinShiftSilently(activeShift);

    navigate(path);
    return true;
  }, [activeShift, joinShiftSilently, mustGateShift, navigate, requestOpenShift, shiftChecked]);

  /** Dipanggil dari tombol Order Baru / Click To Order */
  const startOrderFlow = useCallback(() => {
    ensureShiftThenNavigate('/transaction');
  }, [ensureShiftThenNavigate]);

  /** Guard di halaman POS / menu jika user navigate langsung via URL */
  const ensureShiftForOrder = useCallback(() => {
    if (!mustGateShift) return true;
    if (!shiftChecked) return false;

    if (!activeShift) {
      void requestOpenShift();
      return false;
    }

    if (!isShiftSessionConfirmed(activeShift.id)) joinShiftSilently(activeShift);

    return true;
  }, [activeShift, joinShiftSilently, mustGateShift, requestOpenShift, shiftChecked]);

  const cancelShiftGate = useCallback(() => {
    setIsOpenShiftModalOpen(false);
    setIsResumeModalOpen(false);
    setPendingNavigatePath(null);
    if (!isShiftFreePath(location.pathname)) {
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleShiftClosed = useCallback(() => {
    setActiveShift(null);
    clearShiftFromStorage();
    setSessionReady(false);
    setIsCloseShiftOpen(false);
    setIsOpenShiftModalOpen(false);
    setIsResumeModalOpen(false);
    setPendingNavigatePath(null);
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  /** Blok akses langsung via URL untuk company_id=5 jika shift belum siap */
  useEffect(() => {
    if (!mustGateShift || isLoginPage || !hasToken || !shiftChecked) return;
    if (isShiftFreePath(location.pathname)) return;

    if (!activeShift) {
      void requestOpenShift({ thenNavigate: location.pathname });
      navigate('/dashboard', { replace: true });
      return;
    }

    if (!isShiftSessionConfirmed(activeShift.id)) joinShiftSilently(activeShift);
  }, [
    joinShiftSilently,
    activeShift,
    hasToken,
    isLoginPage,
    location.pathname,
    mustGateShift,
    navigate,
    requestOpenShift,
    shiftChecked
  ]);

  /** Wajib shift tapi shift belum siap → semua halaman hanya bisa dilihat. */
  const viewOnly = Boolean(!isLoginPage && hasToken && mustGateShift && shiftChecked && !(activeShift && sessionReady));
  const viewOnlyRef = useRef(viewOnly);
  viewOnlyRef.current = viewOnly;

  // Penjaga global: tolak request ubah data selama mode lihat saja (berlaku di semua halaman).
  useEffect(() => {
    const id = axios.interceptors.request.use((cfg) => {
      if (viewOnlyRef.current && isBlockedWrite(cfg)) {
        const err = new Error(VIEW_ONLY_MESSAGE);
        err.config = cfg;
        err.isViewOnlyBlock = true;
        err.response = { status: 423, data: { success: false, message: VIEW_ONLY_MESSAGE } };
        return Promise.reject(err);
      }
      return cfg;
    });
    return () => axios.interceptors.request.eject(id);
  }, []);

  const value = useMemo(() => ({
    activeShift,
    outletShift,
    shiftChecked,
    sessionReady,
    isCloseShiftOpen,
    setIsCloseShiftOpen,
    openCloseModal,
    refreshShift,
    applyOpenShift,
    setOutletId,
    startOrderFlow,
    ensureShiftThenNavigate,
    ensureShiftForOrder,
    requestOpenShift,
    cancelShiftGate,
    mustGateShift,
    optionalShift,
    isHq,
    viewOnly,
    isShiftReady: !mustGateShift || (Boolean(activeShift) && sessionReady)
  }), [
    optionalShift,
    viewOnly,
    activeShift,
    outletShift,
    applyOpenShift,
    cancelShiftGate,
    ensureShiftForOrder,
    ensureShiftThenNavigate,
    isCloseShiftOpen,
    isHq,
    mustGateShift,
    openCloseModal,
    refreshShift,
    requestOpenShift,
    sessionReady,
    shiftChecked,
    startOrderFlow
  ]);

  const showShiftGate = !isLoginPage && hasToken && (mustGateShift || optionalShift) && shiftChecked;

  return (
    <ShiftContext.Provider value={value}>
      {children}

      {/* Penanda mode lihat saja di halaman selain dashboard */}
      {viewOnly && !['/', '/dashboard'].includes(location.pathname) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-32px)] max-w-md">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/95 backdrop-blur px-4 py-2.5 shadow-lg">
            <span className="flex-1 min-w-0 text-[11px] sm:text-xs font-bold text-amber-800 leading-snug">
              Mode lihat saja — shift belum dibuka
            </span>
            <button
              type="button"
              onClick={() => requestOpenShift()}
              className="shrink-0 rounded-xl bg-[#5f1340] hover:bg-[#4d0f33] px-3 py-1.5 text-[11px] font-black text-white cursor-pointer"
            >
              Open Shift
            </button>
          </div>
        </div>
      )}

      {showShiftGate && isResumeModalOpen && activeShift && (
        <ResumeShiftModal
          shift={activeShift}
          currentEmployeeId={employeeId}
          onConfirm={confirmResume}
          onCancel={cancelShiftGate}
        />
      )}

      {showShiftGate && isOpenShiftModalOpen && (
        <OpenShiftModal
          outletId={outletId}
          employeeId={employeeId}
          onOpened={applyOpenShift}
          onCancel={cancelShiftGate}
        />
      )}

      {showShiftGate && isCloseShiftOpen && activeShift && (
        <CloseShiftModal
          shift={activeShift}
          employeeId={employeeId}
          onClose={() => setIsCloseShiftOpen(false)}
          onClosed={handleShiftClosed}
        />
      )}
    </ShiftContext.Provider>
  );
}

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (!ctx) {
    throw new Error('useShift must be used within ShiftProvider');
  }
  return ctx;
}

export function useShiftOptional() {
  return useContext(ShiftContext);
}
