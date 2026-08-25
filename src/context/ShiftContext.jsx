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
  syncShiftToStorage
} from '../utils/authSession.js';

const ShiftContext = createContext(null);

export function ShiftProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === '/login';

  const [activeShift, setActiveShift] = useState(null);
  const [shiftChecked, setShiftChecked] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [pendingNavigateToOrder, setPendingNavigateToOrder] = useState(false);
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

    setPendingNavigateToOrder((pending) => {
      if (pending) {
        navigate('/transaction');
      }
      return false;
    });
  }, [navigate]);

  const fetchCurrentShift = useCallback(async (oid = outletId) => {
    if (isLoginPage || !hasToken || isHq) {
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
  }, [hasToken, isHq, isLoginPage, outletId]);

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
    if (options.thenNavigate) setPendingNavigateToOrder(true);
    setIsOpenShiftModalOpen(true);
  }, []);

  /** Dipanggil dari tombol Order Baru / Click To Order */
  const startOrderFlow = useCallback(() => {
    if (isHq) {
      navigate('/transaction');
      return;
    }
    if (!shiftChecked) return;

    if (!activeShift) {
      setPendingNavigateToOrder(true);
      setIsOpenShiftModalOpen(true);
      return;
    }

    if (!isShiftSessionConfirmed(activeShift.id)) {
      setPendingNavigateToOrder(true);
      setIsResumeModalOpen(true);
      return;
    }

    navigate('/transaction');
  }, [activeShift, isHq, navigate, shiftChecked]);

  /** Guard di halaman /transaction jika user navigate langsung */
  const ensureShiftForOrder = useCallback(() => {
    if (isHq) return true;
    if (!shiftChecked) return false;

    if (!activeShift) {
      setPendingNavigateToOrder(false);
      setIsOpenShiftModalOpen(true);
      return false;
    }

    if (!isShiftSessionConfirmed(activeShift.id)) {
      setPendingNavigateToOrder(false);
      setIsResumeModalOpen(true);
      return false;
    }

    return true;
  }, [activeShift, isHq, shiftChecked]);

  const cancelShiftGate = useCallback(() => {
    setIsOpenShiftModalOpen(false);
    setIsResumeModalOpen(false);
    setPendingNavigateToOrder(false);
    if (location.pathname.startsWith('/transaction')) {
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
    setPendingNavigateToOrder(false);
    navigate('/dashboard', { replace: true });
  }, [navigate]);

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
    ensureShiftForOrder,
    requestOpenShift,
    cancelShiftGate,
    /** Halaman browsing (dashboard/riwayat) tidak diblokir — hanya Order Baru yang butuh shift */
    isShiftReady: isHq || (Boolean(activeShift) && sessionReady)
  }), [
    activeShift,
    applyOpenShift,
    cancelShiftGate,
    ensureShiftForOrder,
    isCloseShiftOpen,
    isHq,
    openCloseModal,
    refreshShift,
    requestOpenShift,
    sessionReady,
    shiftChecked,
    startOrderFlow
  ]);

  const showShiftGate = !isLoginPage && hasToken && !isHq && shiftChecked;

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
