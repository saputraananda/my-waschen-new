import React from 'react';
import { Plus, Wallet, ArrowRight } from 'lucide-react';

export default function PettyCashCard({
  netCashInDrawer,
  initialCashFloat,
  totalCashOut,
  navigate
}) {
  return (
    <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col gap-4">
      <div className="flex justify-between items-center pb-3 border-b border-[#e0e0e0]">
        <div>
          <h4 className="text-sm font-extrabold text-[#313030] tracking-tight">Petty Cash</h4>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Shift Kasir Aktif</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/petty-cash')}
          className="px-3.5 py-2 bg-[#5f1340] hover:bg-[#4a0e32] text-white rounded-xl transition-all shadow-xs flex items-center gap-1.5 text-xs font-bold cursor-pointer"
          title="Buka halaman pencatatan petty cash"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Catat Kas</span>
        </button>
      </div>

      {/* Waschen Maroon Filled Card Widget */}
      <div
        onClick={() => navigate('/petty-cash')}
        className="bg-gradient-to-br from-[#5f1340] via-[#4d0f33] to-[#380b26] text-white border-2 border-[#5f1340] hover:border-[#7d1956] rounded-2xl p-5 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden cursor-pointer group"
      >
        {/* Wallet watermark without any dollar sign */}
        <div className="absolute right-[-12px] bottom-[-12px] opacity-10 group-hover:scale-105 transition-transform duration-300 pointer-events-none">
          <Wallet className="w-28 h-28 text-white" />
        </div>

        <div className="relative z-10">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase tracking-widest text-pink-200/90 font-bold block">Petty Cash Card</span>
          </div>

          <span className="text-2xl sm:text-3xl font-black block mt-1 tracking-tight text-white">
            Rp {netCashInDrawer.toLocaleString('id-ID')}
          </span>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/15 text-[10px] font-bold uppercase">
            <div>
              <span className="block text-pink-200/70 text-[8px] tracking-wider">Kas Float Awal:</span>
              <span className="font-extrabold text-white mt-0.5 block">Rp {initialCashFloat.toLocaleString('id-ID')}</span>
            </div>
            <div>
              <span className="block text-pink-200/70 text-[8px] tracking-wider">Total Kas Keluar:</span>
              <span className="font-extrabold text-white mt-0.5 block">Rp {totalCashOut.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
