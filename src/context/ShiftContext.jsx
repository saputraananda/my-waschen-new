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

export function ShiftProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === '/login';
  const mustGateShift = requiresShiftGate();

  const [activeShift, setActiveShift] = useState(null);
  const [shiftChecked, setShiftChecked] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [pendingNavigatePath, setPendingNavigatePath] = useState(null);
  const [outletId, setOutletId] = useState(localStorage.getItem('activeOutletId') || '2');

  const employeeId = getLoggedInEmployeeId();
  const isHq = isHqUser();
  const hasToken = !!localStorage.getItem('token');

  const applyOpenShift = useCallback((shift) => {
    setActiveShift(shift);
    syncShiftToStorage(shift);
    markShiftSessionConfirmed(shift.id);
    setSessionReady(true);
    setIsOpenShiftModalOpen(false);
    setIsResumeModalOpen(false);

    setPendingNavigatePath((pending) => {
      if (pending) {
        navigate(pending);
      }
      return null;
    });
  }, [navigate]);

  const fetchCurrentShift = useCallback(async (oid = outletId) => {
    if (isLoginPage || !hasToken || !mustGateShift) {
      setShiftChecked(true);
      setSessionReady(true);
      return;
    }

    setShiftChecked(false);
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
      setActiveShift(null);
      setSessionReady(false);
    } finally {
      setShiftChecked(true);
    }
  }, [hasToken, isLoginPage, mustGateShift, outletId]);

  useEffect(() => {
    if (isLoginPage || !hasToken) {
      setShiftChecked(true);
      return;
    }
    fetchCurrentShift(outletId);
  }, [fetchCurrentShift, hasToken, isLoginPage, outletId, location.pathname]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'activeOutletId' && e.newValue) {
        setOutletId(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

  const refreshShift = useCallback(() => {
    const oid = localStorage.getItem('activeOutletId') || outletId || '2';
    setOutletId(oid);
    return fetchCurrentShift(oid);
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
