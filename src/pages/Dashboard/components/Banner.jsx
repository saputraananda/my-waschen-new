import React, { useState, useEffect } from 'react';
import { Search, Plus } from 'lucide-react';
import { formatEmployeeName } from '../../../utils/FormatName.js';

const DASHBOARD_SLOGANS = [
  'Total Care for Happy Life',
  'Every clean starts with a great order',
  'Work smarter. Serve better. Grow faster',
  'Small steps. Clean results. Bigger progress',
  'Keep it simple. Keep it moving',
  'Clean work. Smart system. Better business'
];

const getTimeBasedGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 3 && hour < 11) return 'Selamat Pagi,';
  if (hour >= 11 && hour < 15) return 'Selamat Siang,';
  if (hour >= 15 && hour < 18) return 'Selamat Sore,';
  return 'Selamat Malam,';
};

export default function Banner({ userProfile, navigate, onOpenLacakNotaModal, onOrderClick }) {
  const [sloganIndex, setSloganIndex] = useState(0);

  useEffect(() => {
    const sloganTimer = setInterval(() => {
      setSloganIndex(prev => (prev + 1) % DASHBOARD_SLOGANS.length);
    }, 4500);

    return () => clearInterval(sloganTimer);
  }, []);

  const handleLacakNotaClick = () => {
    if (onOpenLacakNotaModal) {
      onOpenLacakNotaModal();
    } else {
      const searchInput = document.getElementById('tracking-search-input');
      if (searchInput) {
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          searchInput.focus();
        }, 300);
      } else {
        const section = document.getElementById('tracking-service-section');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div
      className="bg-gradient-to-r from-[#420a2c] via-[#5f1340] to-[#340722] border border-[#5f1340]/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-xl shadow-[#5f1340]/20 relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 group"
      style={{
        backgroundImage: `
          radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px),
          radial-gradient(rgba(255, 255, 255, 0.04) 1.5px, transparent 1.5px),
          linear-gradient(to right, #420a2c, #5f1340, #340722)
        `,
        backgroundSize: '28px 28px, 14px 14px, 100% 100%',
        backgroundPosition: '0 0, 14px 14px, 0 0'
      }}
    >
      {/* Ambient Animated Lighting & Glows */}
      <div className="absolute top-0 -left-1/4 w-96 h-96 bg-gradient-to-tr from-rose-500/20 via-purple-600/15 to-transparent rounded-full filter blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-20 -right-10 w-96 h-96 bg-gradient-to-bl from-amber-500/15 via-rose-500/15 to-transparent rounded-full filter blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />

      {/* Left Content Area */}
      <div className="relative z-10 min-w-0 flex-1 flex flex-col items-start gap-1 sm:gap-1.5 w-full sm:w-auto">
        <span className="text-xs sm:text-lg md:text-xl font-bold text-rose-100/90 tracking-tight block">
          {getTimeBasedGreeting()}
        </span>

        <h2 className="text-base sm:text-2xl md:text-3xl lg:text-3xl xl:text-4xl font-black text-amber-200 tracking-tight leading-tight block sm:truncate w-full">
          {formatEmployeeName(userProfile?.fullName, 'Kasir Waschen')}
        </h2>

        <div className="h-5 overflow-hidden mt-0.5 hidden sm:block">
          <p
            key={sloganIndex}
            className="text-[10px] sm:text-xs md:text-sm text-rose-100/90 font-medium leading-relaxed animate-fade-in transition-all duration-500"
          >
            {DASHBOARD_SLOGANS[sloganIndex]}
          </p>
        </div>
      </div>

      {/* Right Quick POS Action Buttons */}
      <div className="flex flex-row items-center gap-2 sm:gap-3 relative z-10 w-full sm:w-auto shrink-0">
        <button
          type="button"
          onClick={handleLacakNotaClick}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-xs text-white text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer whitespace-nowrap shadow-xs hover:shadow-md"
          title="Fokus ke pencarian nota antrean"
        >
          <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-200" />
          <span>Lacak Nota</span>
        </button>

        <button
          type="button"
          onClick={() => (onOrderClick ? onOrderClick() : navigate('/transaction'))}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2.5 px-3 sm:px-7 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-[linear-gradient(135deg,#FFE484_0%,#E5B82C_45%,#C69214_100%)] hover:bg-[linear-gradient(135deg,#FFF0A5_0%,#F3C63A_45%,#D8A11F_100%)] border border-[#FFF3B0]/70 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-amber-600/30 hover:shadow-amber-500/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer group/btn whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3px] group-hover/btn:rotate-90 transition-transform duration-300" />
          <span>Click To Order</span>
        </button>
      </div>
    </div>
  );
}
