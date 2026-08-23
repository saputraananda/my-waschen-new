import React, { useState } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  TrendingDown,
  TrendingUp
} from 'lucide-react';

export default function DashboardPettyCash({
  cashLogs,
  initialCashFloat,
  activeOutletName
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('Semua');

  const totalCashIn = cashLogs.filter(c => c.type === 'Masuk').reduce((acc, c) => acc + c.amount, 0);
  const totalCashOut = cashLogs.filter(c => c.type === 'Keluar').reduce((acc, c) => acc + c.amount, 0);
  const netCashInDrawer = initialCashFloat + totalCashIn - totalCashOut;

  const filteredLogs = cashLogs.filter(log => {
    const matchesSearch = log.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.category.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedTypeFilter === 'Semua') return matchesSearch;
    return matchesSearch && log.type === selectedTypeFilter;
  });

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-tr from-[#420a2c] to-[#5f1340] text-white rounded-2xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-widest text-rose-200 block">Uang Tunai Di Laci</span>
          <span className="text-2xl font-black block mt-2 text-amber-300">Rp {netCashInDrawer.toLocaleString('id-ID')}</span>
          <span className="text-[10px] text-rose-100/80 block mt-2 font-medium">Laci Shift Pagi ({activeOutletName})</span>
        </div>

        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-[#5f1340]/5 text-[#5f1340] rounded-xl">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Modal Awal Floating</span>
            <span className="text-lg font-black text-[#313030] block mt-0.5">Rp {initialCashFloat.toLocaleString('id-ID')}</span>
            <span className="text-[10px] text-slate-400">Patokan Modal Dasar</span>
          </div>
        </div>

        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Kas Masuk</span>
            <span className="text-lg font-black text-emerald-700 block mt-0.5">+ Rp {totalCashIn.toLocaleString('id-ID')}</span>
            <span className="text-[10px] text-emerald-600 font-extrabold">{cashLogs.filter(c => c.type === 'Masuk').length} Transaksi</span>
          </div>
        </div>

        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <TrendingDown className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Kas Keluar</span>
            <span className="text-lg font-black text-rose-700 block mt-0.5">- Rp {totalCashOut.toLocaleString('id-ID')}</span>
            <span className="text-[10px] text-rose-600 font-extrabold">{cashLogs.filter(c => c.type === 'Keluar').length} Transaksi</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-xs flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-[#e0e0e0]">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari keterangan atau kategori kas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
            />
          </div>

          <div className="flex items-center gap-2">
            {['Semua', 'Masuk', 'Keluar'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedTypeFilter(type)}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  selectedTypeFilter === type
                    ? 'bg-[#5f1340] text-white shadow-xs'
                    : 'bg-[#f8f8f8] text-slate-600 hover:bg-[#e0e0e0]'
                }`}
              >
                {type === 'Semua' ? 'Semua Kas' : type === 'Masuk' ? '📥 Kas Masuk' : '📤 Kas Keluar'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f8f8] text-slate-400 font-extrabold uppercase text-[10px] border-b border-[#e0e0e0]">
                <th className="py-3.5 px-4">Tipe & Waktu</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Keterangan Transaksi</th>
                <th className="py-3.5 px-4">Pencatat</th>
                <th className="py-3.5 px-4 text-right">Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0e0]/70 font-semibold">
              {filteredLogs.length > 0 ? (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-[#f8f8f8] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {log.type === 'Keluar' ? (
                          <span className="p-1 bg-rose-50 text-rose-600 rounded-md border border-rose-200">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="p-1 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-200">
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <div>
                          <span className="font-bold text-[#313030] block">{log.type}</span>
                          <span className="text-[10px] text-slate-400 block">{log.date}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">
                        {log.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-extrabold">
                      {log.desc}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">
                      {log.createdBy}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-black text-sm ${
                      log.type === 'Keluar' ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {log.type === 'Keluar' ? '-' : '+'} Rp {log.amount.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400 font-bold">
                    Tidak ada data transaksi kas yang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
