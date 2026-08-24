import React from 'react';
import {
  PlusCircle,
  History,
  Info,
  Users,
  CreditCard,
  Wallet
} from 'lucide-react';

export default function Menu({ navigate, onOrderClick }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Menu Cepat POS Laundry</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Order Baru */}
        <button
          type="button"
          onClick={() => (onOrderClick ? onOrderClick() : navigate('/transaction'))}
          className="bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1 cursor-pointer"
        >
          <div className="p-3 bg-[#5f1340]/5 text-[#5f1340] rounded-2xl mb-2.5 group-hover:scale-110 group-hover:bg-[#5f1340]/10 transition-all duration-200">
            <PlusCircle className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-[#313030] group-hover:text-[#5f1340] transition-colors">Order Baru</span>
          <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">POS Laundry</span>
        </button>

        {/* 2. Riwayat */}
        <button
          type="button"
          onClick={() => navigate('/riwayat')}
          className="bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1 cursor-pointer"
        >
          <div className="p-3 bg-rose-50 text-rose-700 rounded-2xl mb-2.5 group-hover:scale-110 group-hover:bg-rose-100/60 transition-all duration-200">
            <History className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-[#313030] group-hover:text-rose-700 transition-colors">Riwayat</span>
          <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">Semua Transaksi</span>
        </button>

        {/* 3. Layanan */}
        <button
          type="button"
          onClick={() => navigate('/services')}
          className="bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1 cursor-pointer"
        >
          <div className="p-3 bg-sky-50 text-sky-700 rounded-2xl mb-2.5 group-hover:scale-110 group-hover:bg-sky-100/60 transition-all duration-200">
            <Info className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-[#313030] group-hover:text-sky-700 transition-colors">Layanan</span>
          <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">Kilo & Satuan</span>
        </button>

        {/* 4. Pelanggan */}
        <button
          type="button"
          onClick={() => navigate('/customer')}
          className="bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1 cursor-pointer"
        >
          <div className="p-3 bg-teal-50 text-teal-700 rounded-2xl mb-2.5 group-hover:scale-110 group-hover:bg-teal-100/60 transition-all duration-200">
            <Users className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-[#313030] group-hover:text-teal-700 transition-colors">Pelanggan</span>
          <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">Data Member</span>
        </button>

        {/* 5. Membership */}
        <button
          type="button"
          onClick={() => navigate('/membership')}
          className="bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1 cursor-pointer"
        >
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl mb-2.5 group-hover:scale-110 group-hover:bg-indigo-100/60 transition-all duration-200">
            <CreditCard className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-[#313030] group-hover:text-indigo-700 transition-colors">Membership</span>
          <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">Saldo Kartu</span>
        </button>

        {/* 6. Petty Cash */}
        <button
          type="button"
          onClick={() => navigate('/petty-cash')}
          className="bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1 cursor-pointer"
        >
          <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl mb-2.5 group-hover:scale-110 group-hover:bg-amber-100/60 transition-all duration-200">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-[#313030] group-hover:text-amber-700 transition-colors">Petty Cash</span>
          <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">Kas Outlet</span>
        </button>
      </div>
    </div>
  );
}
