import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop.jsx';
import { ShiftProvider } from './context/ShiftContext.jsx';
import { AppDialogProvider } from './context/AppDialogContext.jsx';
import { PWAProvider } from './context/PWAContext.jsx';
import Dashboard from './pages/Dashboard/index.jsx';
import Transaction from './pages/Transaction/index.jsx';
import TransactionComplete from './pages/Transaction/components/Complete.jsx';
import Customer from './pages/Customer/index.jsx';
import Services from './pages/Services/index.jsx';
import PettyCash from './pages/PettyCash/index.jsx';
import Membership from './pages/Membership/index.jsx';
import HistoryPage from './pages/History/index.jsx';
import DetailTransaction from './pages/History/components/DetailTransaction.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import DailyReport from './pages/DailyReport/index.jsx';

function App() {
  // Global Modal Backdrop Freeze: Prevents background scrolling across all pages whenever any modal is active
  useEffect(() => {
    const checkModals = () => {
      const modalElements = document.querySelectorAll('.fixed.inset-0, [role="dialog"], .modal-backdrop');
      const isModalOpen = Array.from(modalElements).some(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
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
      <AppDialogProvider>
        <PWAProvider>
          <ShiftProvider>
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
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </ShiftProvider>
        </PWAProvider>
      </AppDialogProvider>
    </Router>
  );
}

export default App;
