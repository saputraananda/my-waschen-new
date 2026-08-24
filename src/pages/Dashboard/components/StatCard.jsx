import React from 'react';
import { Wallet, Package, Clock, AlertCircle } from 'lucide-react';

export default function StatCard({
  todayRevenue,
  monthlyTarget,
  activeOrdersCount,
  readyOrdersCount,
  unpaidOrdersCount,
  setActiveFilterTab
}) {
  const handleStatClick = (filterTabName) => {
    if (setActiveFilterTab) {
      setActiveFilterTab(filterTabName);
    }
    const trackingSection = document.getElementById('tracking-service-section');
    if (trackingSection) {
      trackingSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div>
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Ringkasan Operasional</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">

        {/* Metric 1: Revenue vs Target */}
        <div
          onClick={() => handleStatClick('Selesai')}
          className="bg-white border border-[#e0e0e0]/70 rounded-2xl p-3 sm:p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2.5 sm:gap-4 relative overflow-hidden group cursor-pointer min-w-0"
        >
          <div className="p-2.5 sm:p-3 bg-[#5f1340]/5 text-[#5f1340] rounded-xl shrink-0">
            <Wallet className="h-5 sm:h-6 w-5 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 block uppercase tracking-wider truncate">Revenue</span>
            <span className="text-sm sm:text-lg font-black text-[#313030] block mt-0.5 truncate">Rp {todayRevenue.toLocaleString('id-ID')}</span>

            <div className="mt-1 flex flex-col gap-0.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[9px] font-bold min-w-0">
                <span className="text-slate-400 truncate">Target: Rp {monthlyTarget.toLocaleString('id-ID')}</span>
                <span className="text-[#5f1340] whitespace-nowrap shrink-0">
                  {monthlyTarget > 0 ? ((todayRevenue / monthlyTarget) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-0.5">
                <div
                  className="bg-[#5f1340] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(4, monthlyTarget > 0 ? (todayRevenue / monthlyTarget) * 100 : 0))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Metric 2: Active queue */}
        <div
          onClick={() => handleStatClick('Antrean')}
          className="bg-white border border-[#e0e0e0]/70 rounded-2xl p-3 sm:p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2.5 sm:gap-4 relative overflow-hidden group cursor-pointer min-w-0"
        >
          <div className="p-2.5 sm:p-3 bg-[#5f1340]/5 text-[#5f1340] rounded-xl shrink-0">
            <Package className="h-5 sm:h-6 w-5 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 block uppercase tracking-wider truncate">Antrean Aktif</span>
            <span className="text-sm sm:text-lg font-black text-[#313030] block mt-0.5 truncate">{activeOrdersCount} Nota</span>
            <span className="text-[9px] text-[#5f1340] font-bold block mt-1 truncate">Sedang diproses</span>
          </div>
        </div>

        {/* Metric 3: Ready to pick up */}
        <div
          onClick={() => handleStatClick('Siap Diambil / Diantar')}
          className="bg-white border border-[#e0e0e0]/70 rounded-2xl p-3 sm:p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2.5 sm:gap-4 relative overflow-hidden group cursor-pointer min-w-0"
        >
          <div className="p-2.5 sm:p-3 bg-amber-50 text-amber-700 rounded-xl shrink-0">
            <Clock className="h-5 sm:h-6 w-5 sm:w-6 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 block uppercase tracking-wider truncate">Siap Diambil</span>
            <span className="text-sm sm:text-lg font-black text-[#313030] block mt-0.5 truncate">{readyOrdersCount} Nota</span>
            <span className="text-[9px] text-amber-600 font-bold block mt-1 truncate">Menunggu diambil</span>
          </div>
        </div>

        {/* Metric 4: Nota Belum Lunas */}
        <div
          onClick={() => handleStatClick('Semua')}
          className="bg-white border border-[#e0e0e0]/70 rounded-2xl p-3 sm:p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2.5 sm:gap-4 relative overflow-hidden group cursor-pointer min-w-0"
        >
          <div className="p-2.5 sm:p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0">
            <AlertCircle className="h-5 sm:h-6 w-5 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 block uppercase tracking-wider truncate">Nota Belum Lunas</span>
            <span className="text-sm sm:text-lg font-black text-[#313030] block mt-0.5 truncate">{unpaidOrdersCount} Nota</span>
            <span className="text-[9px] text-rose-600 font-bold block mt-1 truncate">Tagihan belum bayar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
