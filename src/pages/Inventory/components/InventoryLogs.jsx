import React, { useMemo, useState } from 'react';
import { RefreshCcw, Search } from 'lucide-react';
import { formatEmployeeName } from '../../../utils/FormatName.js';

const TYPE_STYLE = {
  In: 'text-emerald-700 bg-emerald-50',
  Out: 'text-rose-700 bg-rose-50',
  Usage: 'text-sky-700 bg-sky-50',
  Adjust: 'text-amber-700 bg-amber-50'
};

export default function InventoryLogs({ logs, onRefresh }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('Semua');

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (logs || []).filter((l) => {
      const matchType = typeFilter === 'Semua' || l.movement_type === typeFilter;
      const matchQ = !q
        || String(l.item_name || '').toLowerCase().includes(q)
        || String(l.notes || '').toLowerCase().includes(q)
        || String(l.employee_name || '').toLowerCase().includes(q);
      return matchType && matchQ;
    });
  }, [logs, searchQuery, typeFilter]);

  return (
    <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari item / catatan / petugas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {['Semua', 'In', 'Out', 'Usage', 'Adjust'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer ${
                typeFilter === t ? 'bg-[#5f1340] text-white' : 'bg-[#f8f8f8] text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-[#f8f8f8] text-slate-600 cursor-pointer flex items-center gap-1"
          >
            <RefreshCcw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-[#f8f8f8] text-slate-400 font-extrabold uppercase text-[10px] border-b">
              <th className="py-3 px-3">Waktu</th>
              <th className="py-3 px-3">Tipe</th>
              <th className="py-3 px-3">Item</th>
              <th className="py-3 px-3 text-right">Qty</th>
              <th className="py-3 px-3 text-right">Sebelum → Sesudah</th>
              <th className="py-3 px-3">Petugas</th>
              <th className="py-3 px-3">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e0e0e0]/70 font-semibold">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400">Belum ada riwayat mutasi</td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr key={l.id} className="hover:bg-[#f8f8f8]">
                  <td className="py-3 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                    {l.created_at
                      ? new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                      : '-'}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${TYPE_STYLE[l.movement_type] || 'bg-slate-100'}`}>
                      {l.movement_type}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-black block text-[#313030]">{l.item_name}</span>
                    <span className="text-[10px] text-slate-400">{l.item_code}</span>
                  </td>
                  <td className="py-3 px-3 text-right font-black">
                    {Number(l.qty).toLocaleString('id-ID')} {l.unit_symbol || ''}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600">
                    {Number(l.qty_before).toLocaleString('id-ID')} → {Number(l.qty_after).toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-3 text-[11px]">
                    {formatEmployeeName(l.employee_name) || '-'}
                  </td>
                  <td className="py-3 px-3 text-[11px] text-slate-500 max-w-[220px] truncate" title={l.notes || ''}>
                    {l.notes || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
