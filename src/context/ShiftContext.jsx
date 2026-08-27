import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import OpenShiftModal from '../pages/Shift/OpenShiftModal.jsx';
import CloseShiftModal from '../pages/Shift/CloseShiftModal.jsx';
import ResumeShiftModal from '../pages/Shift/ResumeShiftModal.jsx';
import {
  clearShiftFromStorage,
  getLoggedInEmployeeId,
  isHqUser,
  isShiftSessionConfirmed,
  markShiftSessionConfirmed,
  requiresShiftGate,
  syncShiftToStorage
} from '../utils/authSession.js';

const ShiftContext = createContext(null);

/** Path yang boleh diakses tanpa shift (login + dashboard saja). */
const SHIFT_FREE_PATHS = ['/login', '/', '/dashboard'];

function isShiftFreePath(pathname) {
  if (!pathname) return false;
  return SHIFT_FREE_PATHS.some((p) => pathname === p);
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
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [pendingNavigatePath, setPendingNavigatePath] = useState(null);
  const [outletId, setOutletId] = useState(localStorage.getItem('activeOutletId') || '2');
  /** Reactive auth flags — di-sync setelah login / ganti route (localStorage tidak trigger re-render) */
  const [mustGateShift, setMustGateShift] = useState(() => requiresShiftGate());
  const [hasToken, setHasToken] = useState(() => !!localStorage.getItem('token'));
  const [authEpoch, setAuthEpoch] = useState(0);

  const employeeId = getLoggedInEmployeeId();
  const isHq = isHqUser();

  const syncAuthFlags = useCallback((options = {}) => {
    const nextGate = requiresShiftGate();
    const nextToken = !!localStorage.getItem('token');
    const oid = localStorage.getItem('activeOutletId');

    setMustGateShift((prev) => (prev === nextGate ? prev : nextGate));
    setHasToken((prev) => (prev === nextToken ? prev : nextToken));
    if (oid) {
      setOutletId((prev) => (String(prev) === String(oid) ? prev : oid));
    }

    // Hanya bump epoch jika auth benar-benar berubah (hindari refetch berulang)
    if (options.force || options.authChanged) {
      setAuthEpoch((n) => n + 1);
    }
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
    const gated = requiresShiftGate();
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
      setShiftChecked(true);
      setSessionReady(true);
      return;
    }

    // Soft refresh: tetap tampilkan shift lama / optimistic — jangan flash "Belum Open"
    if (!soft) {
      setShiftChecked(false);
    }

    try {
      const res = await axios.get('/api/shifts/current', {
        params: { outlet_id: oid || 2 }
      });

      if (res.data?.success && res.data.data) {
        const shift = res.data.data;
        setActiveShift(shift);

        const currentEmpId = getLoggedInEmployeeId();
        const isSameOpener = Number(shift.cashier_employee_id) === Number(currentEmpId);
        const alreadyConfirmed = isShiftSessionConfirmed(shift.id);

        const confirmed = alreadyConfirmed || isSameOpener;
        setSessionReady(confirmed);
        if (confirmed) {
          syncShiftToStorage(shift);
          markShiftSessionConfirmed(shift.id);
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
  }, [isLoginPage, outletId]);

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

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('waschen:auth-changed', onAuthChanged);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchCurrentShift, isLoginPage, outletId, syncAuthFlags]);

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

  const openCloseModal = useCallback(() => setIsCloseShiftOpen(true), []);

  const requestOpenShift = useCallback((options = {}) => {
    if (options.thenNavigate) {
      setPendingNavigatePath(typeof options.thenNavigate === 'string' ? options.thenNavigate : '/transaction');
    }
    setIsOpenShiftModalOpen(true);
  }, []);

  /**
   * Guard navigasi menu: company_id=5 wajib shift terbuka.
   * company_id=1 (HQ) dan selain 5 bebas.
   */
  const ensureShiftThenNavigate = useCallback((path = '/transaction') => {
    if (!mustGateShift) {
      navigate(path);
      return true;
    }
    if (!shiftChecked) return false;

    if (!activeShift) {
      setPendingNavigatePath(path);
      setIsOpenShiftModalOpen(true);
      return false;
    }

    if (!isShiftSessionConfirmed(activeShift.id)) {
      setPendingNavigatePath(path);
      setIsResumeModalOpen(true);
      return false;
    }

    navigate(path);
    return true;
  }, [activeShift, mustGateShift, navigate, shiftChecked]);

  /** Dipanggil dari tombol Order Baru / Click To Order */
  const startOrderFlow = useCallback(() => {
    ensureShiftThenNavigate('/transaction');
  }, [ensureShiftThenNavigate]);

  /** Guard di halaman POS / menu jika user navigate langsung via URL */
  const ensureShiftForOrder = useCallback(() => {
    if (!mustGateShift) return true;
    if (!shiftChecked) return false;

    if (!activeShift) {
      setPendingNavigatePath(null);
      setIsOpenShiftModalOpen(true);
      return false;
    }

    if (!isShiftSessionConfirmed(activeShift.id)) {
      setPendingNavigatePath(null);
      setIsResumeModalOpen(true);
      return false;
    }

    return true;
  }, [activeShift, mustGateShift, shiftChecked]);

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
      setPendingNavigatePath(location.pathname);
      setIsOpenShiftModalOpen(true);
      navigate('/dashboard', { replace: true });
      return;
    }

    if (!isShiftSessionConfirmed(activeShift.id)) {
      setPendingNavigatePath(location.pathname);
      setIsResumeModalOpen(true);
      navigate('/dashboard', { replace: true });
    }
  }, [
    activeShift,
    hasToken,
    isLoginPage,
    location.pathname,
    mustGateShift,
    navigate,
    shiftChecked
  ]);

  const value = useMemo(() => ({
    activeShift,
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
    isHq,
    isShiftReady: !mustGateShift || (Boolean(activeShift) && sessionReady)
  }), [
    activeShift,
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

  const showShiftGate = !isLoginPage && hasToken && mustGateShift && shiftChecked;

  return (
    <ShiftContext.Provider value={value}>
      {children}

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
