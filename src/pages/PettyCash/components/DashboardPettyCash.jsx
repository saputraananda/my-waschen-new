import React, { useState } from 'react';
import axios from 'axios';
import { formatEmployeeName } from '../../../utils/FormatName.js';
import { Search, Check, X, ExternalLink, Clock } from 'lucide-react';
import { useAppDialog } from '../../../context/AppDialogContext.jsx';

const STATUS_STYLE = {
  Pengajuan: 'bg-amber-100 text-amber-800',
  Disetujui: 'bg-emerald-100 text-emerald-800',
  Ditolak: 'bg-rose-100 text-rose-800'
};

export default function DashboardPettyCash({
  cashLogs,
  initialPettyCashFloat,
  currentBalance,
  pendingCount = 0,
  activeOutletName,
  isApprover,
  onRefresh
}) {
  const { showAlert, showConfirm } = useAppDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('Semua');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('Semua');
  const [reviewingId, setReviewingId] = useState(null);

  const approvedLogs = cashLogs.filter((c) => c.status === 'Disetujui');
  const totalCashIn = approvedLogs.filter(c => c.type === 'Masuk').reduce((acc, c) => acc + c.amount, 0);
  const totalCashOut = approvedLogs.filter(c => c.type === 'Keluar').reduce((acc, c) => acc + c.amount, 0);
  const netCashInDrawer = initialPettyCashFloat + totalCashIn - totalCashOut;

  const filteredLogs = cashLogs.filter(log => {
    const matchesSearch = log.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = selectedTypeFilter === 'Semua' || log.type === selectedTypeFilter;
    const matchStatus = selectedStatusFilter === 'Semua' || log.status === selectedStatusFilter;
    return matchesSearch && matchType && matchStatus;
  });

  const handleReview = async (log, action) => {
    if (action === 'reject') {
      const ok = await showConfirm({
        title: 'Tolak pengajuan?',
        message: `${log.category} — Rp ${log.amount.toLocaleString('id-ID')}`,
        confirmLabel: 'Tolak',
        variant: 'danger'
      });
      if (!ok) return;
    }

    setReviewingId(log.id);
    try {
      const res = await axios.patch(`/api/petty-cash/${log.id}/review`, {
        action,
        reviewerEmployeeId: parseInt(localStorage.getItem('employeeId'), 10) || null
      });
      if (!res.data?.success) throw new Error(res.data?.message || 'Gagal');
      await showAlert({
        title: action === 'approve' ? 'Disetujui' : 'Ditolak',
        message: res.data.message,
        type: 'success'
      });
      onRefresh?.();
    } catch (err) {
      await showAlert({
        title: 'Gagal',
        message: err?.response?.data?.message || err.message,
        type: 'error'
      });
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-tr from-[#420a2c] to-[#5f1340] text-white rounded-2xl p-5 shadow-md flex flex-col justify-between md:col-span-1">
          <span className="text-[10px] uppercase font-bold tracking-widest text-rose-200 block">Uang Tunai Di Laci</span>
          <span className="text-2xl font-black block mt-2 text-amber-300">Rp {netCashInDrawer.toLocaleString('id-ID')}</span>
          <span className="text-[10px] text-rose-100/80 block mt-2 font-medium">Laci Shift ({activeOutletName})</span>
        </div>

        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Modal Awal</span>
          <span className="text-lg font-black text-[#313030] block mt-1">Rp {initialPettyCashFloat.toLocaleString('id-ID')}</span>
        </div>

        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kas Masuk (Disetujui)</span>
          <span className="text-lg font-black text-emerald-700 block mt-1">+ Rp {totalCashIn.toLocaleString('id-ID')}</span>
        </div>

        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kas Keluar (Disetujui)</span>
          <span className="text-lg font-black text-rose-700 block mt-1">- Rp {totalCashOut.toLocaleString('id-ID')}</span>
        </div>

        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Menunggu Persetujuan
          </span>
          <span className="text-2xl font-black text-amber-700 block mt-1">{pendingCount}</span>
        </div>
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-6 shadow-xs flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 pb-4 border-b border-[#e0e0e0]">
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari keterangan / kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#e0e0e0] rounded-xl text-xs font-bold outline-none focus:border-[#5f1340]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            {['Semua', 'Pengajuan', 'Disetujui', 'Ditolak'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                  selectedStatusFilter === st
                    ? 'bg-[#5f1340] text-white'
                    : 'bg-[#f8f8f8] text-slate-600 hover:bg-[#e0e0e0]'
                }`}
              >
                {st}
              </button>
            ))}
            <span className="w-px h-6 bg-[#e0e0e0] hidden sm:block" />
            {['Semua', 'Masuk', 'Keluar'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedTypeFilter(type)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                  selectedTypeFilter === type
                    ? 'bg-slate-700 text-white'
                    : 'bg-[#f8f8f8] text-slate-600'
                }`}
              >
                {type === 'Semua' ? 'Semua Tipe' : type}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#f8f8f8] text-slate-400 font-extrabold uppercase text-[10px] border-b border-[#e0e0e0]">
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Tipe & Waktu</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Keterangan</th>
                <th className="py-3.5 px-4 text-center">Bukti</th>
                <th className="py-3.5 px-4 text-right">Nominal</th>
                {isApprover && <th className="py-3.5 px-4 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0e0]/70 font-semibold">
              {filteredLogs.length > 0 ? (
                filteredLogs.map(log => (
                  <tr key={log.id} className={`hover:bg-[#f8f8f8] transition-colors ${log.status === 'Pengajuan' ? 'bg-amber-50/30' : ''}`}>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black ${STATUS_STYLE[log.status] || 'bg-slate-100 text-slate-600'}`}>
                        {log.status || 'Pengajuan'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`font-bold block ${log.type === 'Keluar' ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {log.type}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{log.date}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[10px]">
                        {log.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-extrabold max-w-[200px]">
                      {log.desc}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {log.receiptPhotoUrl ? (
                        <a
                          href={log.receiptPhotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-black text-[#5f1340] hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Lihat
                        </a>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className={`py-3.5 px-4 text-right font-black text-sm ${
                      log.type === 'Keluar' ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {log.type === 'Keluar' ? '-' : '+'} Rp {log.amount.toLocaleString('id-ID')}
                    </td>
                    {isApprover && (
                      <td className="py-3.5 px-4 text-center">
                        {log.status === 'Pengajuan' ? (
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              disabled={reviewingId === log.id}
                              onClick={() => handleReview(log, 'approve')}
                              title="Setujui"
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={reviewingId === log.id}
                              onClick={() => handleReview(log, 'reject')}
                              title="Tolak"
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isApprover ? 7 : 6} className="py-12 text-center text-slate-400 font-bold">
                    Tidak ada data transaksi kas.
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
