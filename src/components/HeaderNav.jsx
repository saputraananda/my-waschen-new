import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import waschenLogo from '../assets/images/waschen.webp';
import { formatEmployeeName } from '../utils/FormatName.js';
import { logoutSession } from '../utils/authSession.js';
import { useShiftOptional } from '../context/ShiftContext.jsx';
import { usePWA } from '../context/PWAContext.jsx';
import {
  ChevronDown,
  LogOut,
  ArrowLeft,
  FileText,
  Download,
  Printer
} from 'lucide-react';

export default function HeaderNav({
  activeOutletName,
  setActiveOutletName,
  activeOutletId,
  setActiveOutletId,
  outlets,
  userProfile,
  activeShift: activeShiftProp,
  onRequestCloseShift: onCloseProp
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const shiftCtx = useShiftOptional();
  const activeShift = activeShiftProp ?? shiftCtx?.activeShift;
  const onRequestCloseShift = onCloseProp ?? shiftCtx?.openCloseModal;
  const { promptInstall, isInstalled } = usePWA();

  const handleLogout = () => {
    logoutSession();
    window.dispatchEvent(new Event('waschen:auth-changed'));
    navigate('/login', { replace: true });
  };

  const isSubPage = location.pathname !== '/dashboard' && location.pathname !== '/';

  /** Parent page yang pasti — utamakan state.from (asal navigasi), hindari loncat history salah */
  const resolveBackPath = () => {
    const from = location.state?.from;
    if (typeof from === 'string' && from.startsWith('/') && from !== location.pathname) {
      return from;
    }

    const path = location.pathname;
    if (/^\/(riwayat|history)\/[^/]+/.test(path)) return '/riwayat';
    if (path === '/riwayat' || path === '/history') return '/dashboard';
    if (path.startsWith('/transaction')) return '/dashboard';
    if (
      path === '/customer' ||
      path === '/membership' ||
      path === '/services' ||
      path === '/petty-cash' ||
      path === '/daily-report' ||
      path === '/settings/printer'
    ) {
      return '/dashboard';
    }
    return null;
  };

  const handleBack = () => {
    const backPath = resolveBackPath();
    if (backPath) {
      navigate(backPath);
      return;
    }
    // Fallback: history browser hanya jika ada entry SPA sebelumnya
    if (location.key && location.key !== 'default') {
      navigate(-1);
      return;
    }
    navigate('/dashboard');
  };

  const shiftLabel = (() => {
    if (!activeShift) {
      if (shiftCtx?.mustGateShift && shiftCtx?.shiftChecked === false) {
        return 'Cek shift…';
      }
      const sn = localStorage.getItem('shiftNumber');
      if (sn === '2') return 'Shift Siang (10.30 - 20.00)';
      if (sn === '1') return 'Shift Pagi (08.00 - 17.00)';
      return 'Belum Open Shift';
    }
    return Number(activeShift.shift_number) === 2
      ? 'Shift Siang (10.30 - 20.00)'
      : 'Shift Pagi (08.00 - 17.00)';
  })();

  return (
    <header className="relative z-30 bg-white border-b border-[#e0e0e0]/60 shadow-xs">
      {/* Top Bar */}
      <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          {isSubPage && (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-[#5f1340]/5 hover:bg-[#5f1340]/10 border border-[#5f1340]/20 rounded-xl text-[#5f1340] text-[11px] sm:text-xs font-black transition-all cursor-pointer shrink-0"
              title="Kembali"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Kembali</span>
            </button>
          )}

          <img
            src={waschenLogo}
            alt="Waschen Laundry Logo"
            className="h-7 sm:h-9 md:h-10 w-auto object-contain transition-transform hover:scale-105 cursor-pointer shrink-0"
            onClick={() => navigate('/dashboard')}
          />
          <div className="h-4 sm:h-5 w-[1px] bg-[#e0e0e0] shrink-0 hidden xs:block" />

          {/* Branch Selector / Name Display */}
          {localStorage.getItem('companyId') === '1' && outlets && outlets.length > 0 ? (
            <div className="relative min-w-0 flex-1 max-w-[150px] xs:max-w-[200px] sm:max-w-none">
              <select
                value={activeOutletId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const outlet = outlets.find(o => String(o.id) === String(selectedId));
                  const outletName = outlet ? outlet.full_name || outlet.name : 'Waschen Laundry Citra Gran';
                  localStorage.setItem('activeOutletId', selectedId);
                  localStorage.setItem('activeOutletName', outletName);
                  if (setActiveOutletId) setActiveOutletId(selectedId);
                  if (setActiveOutletName) setActiveOutletName(outletName);
                  if (shiftCtx?.setOutletId) shiftCtx.setOutletId(selectedId);
                  if (shiftCtx?.refreshShift) shiftCtx.refreshShift();
                }}
                className="w-full bg-transparent hover:bg-slate-100 border border-transparent hover:border-[#e0e0e0] rounded-xl pl-1.5 pr-5 py-1 text-xs md:text-sm font-extrabold text-[#313030] outline-none cursor-pointer appearance-none transition-colors truncate"
              >
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.full_name || o.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown className="h-3 w-3" />
              </div>
            </div>
          ) : (
            <span className="text-xs md:text-sm font-extrabold text-[#313030] tracking-tight truncate block max-w-[130px] xs:max-w-[200px] sm:max-w-none min-w-0">
              {(activeOutletName && activeOutletName !== 'Outlet Waschen')
                ? activeOutletName
                : (localStorage.getItem('activeOutletName') && localStorage.getItem('activeOutletName') !== 'Outlet Waschen')
                  ? localStorage.getItem('activeOutletName')
                  : 'Waschen Laundry Citra Gran'}
            </span>
          )}
        </div>

        {/* Shift Details & Profile Dropdown */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs font-bold text-slate-600 shrink-0">
          <div className="text-left leading-tight hidden md:block pr-2">
            <span className="text-[11px] font-bold text-[#313030] block">{shiftLabel}</span>
          </div>

          {userProfile && (
            <div className="relative pl-2 sm:pl-3 border-l border-[#e0e0e0]">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-1.5 sm:gap-2 text-left focus:outline-none cursor-pointer group"
              >
                <div className="relative">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-[#5f1340]/10 to-[#5f1340]/30 border border-[#5f1340]/20 flex items-center justify-center text-[#5f1340] text-xs font-bold overflow-hidden shadow-xs group-hover:scale-105 transition-all duration-200">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(formatEmployeeName(userProfile.fullName))}&background=5f1340&color=fff`}
                      alt={formatEmployeeName(userProfile.fullName)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white" />
                </div>
                <div className="hidden md:block leading-tight">
                  <span className="text-[11px] font-extrabold text-[#313030] block">{formatEmployeeName(userProfile.fullName)}</span>
                  <span className="text-[9px] text-[#5f1340] font-black uppercase tracking-wider block mt-0.5">{userProfile.role || 'Staff Kasir'}</span>
                </div>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProfileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-20 cursor-default" onClick={() => setIsProfileDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-[#e0e0e0] rounded-2xl shadow-xl py-2 z-30 animate-fade-in text-xs font-semibold text-slate-700">
                    <div className="px-4 py-2 border-b border-slate-100 md:hidden">
                      <span className="block font-black text-slate-700">{formatEmployeeName(userProfile.fullName)}</span>
                      <span className="block text-[9px] text-[#5f1340] font-black uppercase tracking-wider mt-0.5">{userProfile.role || 'Staff Kasir'}</span>
                    </div>
                    <div className="px-4 py-1.5 text-[9px] text-slate-400 uppercase font-black tracking-wider">
                      Opsi Akun
                    </div>
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        navigate('/daily-report');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#5f1340]/5 text-[#313030] flex items-center gap-2 font-bold cursor-pointer transition-colors"
                    >
                      <FileText className="h-4 w-4 text-[#5f1340]" />
                      <span>Daily Report</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        promptInstall();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#5f1340]/5 text-[#313030] flex items-center justify-between font-bold cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-[#5f1340]" />
                        <span>{isInstalled ? 'Aplikasi Terinstall' : 'Download Aplikasi'}</span>
                      </div>
                      {isInstalled && (
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-black">
                          Aktif
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        navigate('/settings/printer');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#5f1340]/5 text-[#313030] flex items-center gap-2 font-bold cursor-pointer transition-colors"
                    >
                      <Printer className="h-4 w-4 text-[#5f1340]" />
                      <span>Setting Printer</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-bold cursor-pointer transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Keluar Aplikasi</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
