import React from 'react';
import { Wallet } from 'lucide-react';

export default function PettyCashCard({
  netCashInDrawer,
  initialPettyCashFloat,
  totalCashOut,
  navigate
}) {
  return (
      <div
        onClick={() => navigate('/petty-cash')}
        className="h-full flex flex-col bg-gradient-to-br from-[#5f1340] via-[#4d0f33] to-[#380b26] text-white border-2 border-[#5f1340] hover:border-[#7d1956] rounded-2xl sm:rounded-3xl p-5 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden cursor-pointer group"
      >
        {/* Wallet watermark without any dollar sign */}
        <div className="absolute right-[-12px] bottom-[-12px] opacity-10 group-hover:scale-105 transition-transform duration-300 pointer-events-none">
          <Wallet className="w-28 h-28 text-white" />
        </div>

        <div className="relative z-10 flex flex-col flex-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase tracking-widest text-pink-200/90 font-bold block">Petty Cash Card</span>
          </div>

          <span className="text-2xl sm:text-3xl font-black block mt-1 tracking-tight text-white">
            Rp {netCashInDrawer.toLocaleString('id-ID')}
          </span>

          <div className="grid grid-cols-2 gap-3 mt-auto pt-3 border-t border-white/15 text-[10px] font-bold uppercase">
            <div>
              <span className="block text-pink-200/70 text-[8px] tracking-wider">Kas Float Awal:</span>
              <span className="font-extrabold text-white mt-0.5 block">Rp {initialPettyCashFloat.toLocaleString('id-ID')}</span>
            </div>
            <div>
              <span className="block text-pink-200/70 text-[8px] tracking-wider">Total Kas Keluar:</span>
              <span className="font-extrabold text-white mt-0.5 block">Rp {totalCashOut.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      </div>
  );
}
