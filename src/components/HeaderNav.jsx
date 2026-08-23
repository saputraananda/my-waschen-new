import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import waschenLogo from '../assets/images/waschen.webp';
import { formatName } from '../utils/FormatName';
import {
  ChevronDown,
  LogOut,
  ArrowLeft
} from 'lucide-react';

export default function HeaderNav({ activeOutletName, setActiveOutletName, activeOutletId, setActiveOutletId, outlets, userProfile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  const isSubPage = location.pathname !== '/dashboard' && location.pathname !== '/';

  return (
    <header className="relative z-30 bg-white border-b border-[#e0e0e0]/60 shadow-xs">
      {/* Top Bar */}
      <div className="px-4 md:px-6 py-3 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <div className="flex items-center gap-2.5">
            {isSubPage && (
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5f1340]/5 hover:bg-[#5f1340]/10 border border-[#5f1340]/20 rounded-xl text-[#5f1340] text-xs font-black transition-all cursor-pointer mr-1"
                title="Kembali ke Halaman Sebelumnya"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Kembali</span>
              </button>
            )}

            <img
              src={waschenLogo}
              alt="Waschen Laundry Logo"
              className="h-9 md:h-10 w-auto object-contain transition-transform hover:scale-105 cursor-pointer"
              onClick={() => navigate('/dashboard')}
            />
            <div className="h-5 w-[1px] bg-[#e0e0e0]" />

            {/* Branch Selector / Name Display */}
            {localStorage.getItem('companyId') === '1' && outlets && outlets.length > 0 ? (
              <div className="relative">
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
                  }}
                  className="bg-transparent hover:bg-slate-100 border border-transparent hover:border-[#e0e0e0] rounded-xl pl-2 pr-6 py-1 text-xs md:text-sm font-extrabold text-[#313030] outline-none cursor-pointer appearance-none transition-colors"
                >
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.full_name || o.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <ChevronDown className="h-3 w-3" />
                </div>
              </div>
            ) : (
              <span className="text-xs md:text-sm font-extrabold text-[#313030] tracking-tight pl-1">
                {(activeOutletName && activeOutletName !== 'Outlet Waschen')
                  ? activeOutletName
                  : (localStorage.getItem('activeOutletName') && localStorage.getItem('activeOutletName') !== 'Outlet Waschen')
                    ? localStorage.getItem('activeOutletName')
                    : 'Waschen Laundry Citra Gran'}
              </span>
            )}
          </div>
        </div>

        {/* Shift Details & Profile Dropdown */}
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 text-xs font-bold text-slate-600">
          <div className="text-left leading-tight hidden md:block pr-2">
            <span className="text-[11px] font-bold text-[#313030] block">Shift Pagi (08.00 - 17.00)</span>
          </div>

          {userProfile && (
            <div className="relative pl-3 border-l border-[#e0e0e0]">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-2 text-left focus:outline-none cursor-pointer group"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#5f1340]/10 to-[#5f1340]/30 border border-[#5f1340]/20 flex items-center justify-center text-[#5f1340] text-xs font-bold overflow-hidden shadow-xs group-hover:scale-105 transition-all duration-200">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(formatName(userProfile.fullName || 'Kasir'))}&background=5f1340&color=fff`}
                      alt={formatName(userProfile.fullName || 'Kasir')}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white" />
                </div>
                <div className="hidden md:block leading-tight">
                  <span className="text-[11px] font-extrabold text-[#313030] block">{formatName(userProfile.fullName || 'Kasir')}</span>
                  <span className="text-[9px] text-[#5f1340] font-black uppercase tracking-wider block mt-0.5">{userProfile.role || 'Staff Kasir'}</span>
                </div>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProfileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-20 cursor-default" onClick={() => setIsProfileDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-[#e0e0e0] rounded-2xl shadow-xl py-2 z-30 animate-fade-in text-xs font-semibold text-slate-700">
                    <div className="px-4 py-2 border-b border-slate-100 md:hidden">
                      <span className="block font-black text-slate-700">{formatName(userProfile.fullName || 'Kasir')}</span>
                      <span className="block text-[9px] text-[#5f1340] font-black uppercase tracking-wider mt-0.5">{userProfile.role || 'Staff Kasir'}</span>
                    </div>
                    <div className="px-4 py-1.5 text-[9px] text-slate-400 uppercase font-black tracking-wider">
                      Opsi Akun
                    </div>
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
