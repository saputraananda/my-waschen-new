import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop.jsx';
import NetworkStatusModal from './components/NetworkStatusModal.jsx';
import PageLoadBoundary, { PageLoading } from './components/PageLoadBoundary.jsx';
import { ShiftProvider } from './context/ShiftContext.jsx';
import { AppDialogProvider } from './context/AppDialogContext.jsx';
import { PWAProvider } from './context/PWAContext.jsx';
import { ThermalPrinterProvider } from './context/ThermalPrinterContext.jsx';
const Dashboard = lazy(() => import('./pages/Dashboard/index.jsx'));
const Transaction = lazy(() => import('./pages/Transaction/index.jsx'));
const TransactionComplete = lazy(() => import('./pages/Transaction/components/Complete.jsx'));
const Customer = lazy(() => import('./pages/Customer/index.jsx'));
const Services = lazy(() => import('./pages/Services/index.jsx'));
const PettyCash = lazy(() => import('./pages/PettyCash/index.jsx'));
const Membership = lazy(() => import('./pages/Membership/index.jsx'));
const HistoryPage = lazy(() => import('./pages/History/index.jsx'));
const DetailTransaction = lazy(() => import('./pages/History/components/DetailTransaction.jsx'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'));
const DailyReport = lazy(() => import('./pages/DailyReport/index.jsx'));
const DepositReport = lazy(() => import('./pages/Deposit-Report/index.jsx'));
const PrinterSettings = lazy(() => import('./pages/Settings/PrinterSettings.jsx'));
const InventoryPage = lazy(() => import('./pages/Inventory/index.jsx'));
const QCFrontDeliv = lazy(() => import('./pages/Dashboard/components/QCFrontDeliv.jsx'));
const EventDistribution = lazy(() => import('./pages/EventDistribution/index.jsx'));
const ComplaintRequest = lazy(() => import('./pages/Complaint/index.jsx'));

function App() {
  // Global Modal Backdrop Freeze: Prevents background scrolling across all pages whenever any modal is active
  useEffect(() => {
    const checkModals = () => {
      const modalElements = document.querySelectorAll('.fixed.inset-0, [role="dialog"], .modal-backdrop');
      const isModalOpen = Array.from(modalElements).some(el => {
        const style = window.getComputedStyle(el);
        // Jangan cek opacity: modal dengan animate-fade-in mulai dari 0
        // sehingga scroll lock gagal aktif.
        return style.display !== 'none' && style.visibility !== 'hidden';
      });

      if (isModalOpen) {
        if (!document.body.classList.contains('modal-open')) {
          const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
          document.body.classList.add('modal-open');
          document.documentElement.classList.add('modal-open');
          document.body.style.overflow = 'hidden';
          document.documentElement.style.overflow = 'hidden';
          if (scrollBarWidth > 0) {
            document.body.style.paddingRight = `${scrollBarWidth}px`;
          }
        }
      } else {
        if (document.body.classList.contains('modal-open')) {
          document.body.classList.remove('modal-open');
          document.documentElement.classList.remove('modal-open');
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
          document.body.style.paddingRight = '';
        }
      }
    };

    checkModals();

    const observer = new MutationObserver(() => {
      checkModals();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden']
    });

    return () => {
      observer.disconnect();
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, []);

  return (
    <Router>
      <ScrollToTop />
      <NetworkStatusModal />
      <AppDialogProvider>
        <PWAProvider>
          <ThermalPrinterProvider>
            <ShiftProvider>
              <PageLoadBoundary>
              <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/transaction" element={<Transaction />} />
                <Route path="/transaction/complete" element={<TransactionComplete />} />
                <Route path="/customer" element={<Customer />} />
                <Route path="/membership" element={<Membership />} />
                <Route path="/riwayat" element={<HistoryPage />} />
                <Route path="/riwayat/:orderNo" element={<DetailTransaction />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/history/:orderNo" element={<DetailTransaction />} />
                <Route path="/services" element={<Services />} />
                <Route path="/petty-cash" element={<PettyCash />} />
                <Route path="/daily-report" element={<DailyReport />} />
                <Route path="/deposit-report" element={<DepositReport />} />
                <Route path="/settings/printer" element={<PrinterSettings />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/qc" element={<QCFrontDeliv />} />
                <Route path="/event-distribusi" element={<EventDistribution />} />
                <Route path="/complaint" element={<ComplaintRequest />} />
                <Route path="/login" element={<LoginPage />} />
              </Routes>
              </Suspense>
              </PageLoadBoundary>
            </ShiftProvider>
          </ThermalPrinterProvider>
        </PWAProvider>
      </AppDialogProvider>
    </Router>
  );
}

export default App;
