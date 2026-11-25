import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Search, Check, X, Clock, ChevronRight, FileText, ImageOff, Maximize2 } from 'lucide-react';
import { useAppDialog } from '../../../context/AppDialogContext.jsx';
import ImageLightbox from '../../../components/ImageLightbox.jsx';
import { formatEmployeeName } from '../../../utils/FormatName.js';

const STATUS_STYLE = {
  Pengajuan: 'bg-amber-100 text-amber-800',
  Disetujui: 'bg-emerald-100 text-emerald-800',
  Ditolak: 'bg-rose-100 text-rose-800'
};

const formatRp = (n) => `Rp ${(Number(n) || 0).toLocaleString('id-ID')}`;
const isPdf = (url) => /\.pdf(\?|$)/i.test(String(url || ''));

/** Pratinjau bukti di dalam modal rincian; ketuk untuk layar penuh. */
function ProofPreview({ url, title }) {
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);

  if (!url) {
    return <p className="text-xs font-bold text-slate-400">Tidak ada bukti</p>;
  }
  if (isPdf(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#e0e0e0] text-xs font-black text-[#5f1340] hover:border-[#5f1340]"
      >
        <FileText className="h-4 w-4" /> Buka bukti (PDF)
      </a>
    );
  }
  if (failed) {
    return (
      <div className="rounded-xl border border-dashed border-[#e0e0e0] bg-slate-50 py-6 flex flex-col items-center gap-1 text-center">
        <ImageOff className="h-6 w-6 text-slate-300" />
        <p className="text-xs font-bold text-slate-500">Gambar tidak dapat dimuat</p>
        <p className="text-[11px] text-slate-400">File bukti tidak ditemukan di server.</p>
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="group relative block w-full overflow-hidden rounded-xl border border-[#e0e0e0] bg-slate-50 cursor-zoom-in"
        title="Perbesar bukti"
      >
        <img src={url} alt={title} onError={() => setFailed(true)} className="w-full max-h-64 object-contain" />
        <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-bold text-white opacity-90 group-hover:opacity-100">
          <Maximize2 className="h-3 w-3" /> Perbesar
        </span>
      </button>
      {zoom && <ImageLightbox src={url} alt={title} title={title} onClose={() => setZoom(false)} />}
    </>
  );
}

/** Modal rincian satu pengajuan kas (HP: bottom sheet, desktop: dialog tengah). */
function PettyCashDetailModal({ log, isApprover, reviewing, onReview, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const isOut = log.type === 'Keluar';
  const rows = [
    ['Tanggal', log.date],
    ['Diajukan oleh', log.requesterName ? formatEmployeeName(log.requesterName) : '-'],
    ...(log.status !== 'Pengajuan' && log.reviewerName
      ? [[log.status === 'Ditolak' ? 'Ditolak oleh' : 'Disetujui oleh', formatEmployeeName(log.reviewerName)]]
      : []),
    ['Tipe', log.type],
    ['Keterangan', log.desc],
    ['Sumber', log.isPettyCash === false ? 'Central Cash' : 'Petty Cash'],
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-[#313030]/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rincian kas"
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl"
      >
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-[#e0e0e0]/70">
          <div className="min-w-0">
            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black ${STATUS_STYLE[log.status] || 'bg-slate-100 text-slate-600'}`}>
              {log.status || 'Pengajuan'}
            </span>
            <h3 className="mt-1.5 text-base font-black text-[#313030] leading-snug break-words">{log.category || 'Petty Cash'}</h3>
            <p className={`mt-0.5 text-xl font-black ${isOut ? 'text-rose-600' : 'text-emerald-600'}`}>
              {isOut ? '−' : '+'} {formatRp(log.amount)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 h-9 w-9 grid place-items-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
            {rows.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="font-bold text-slate-400">{k}</dt>
                <dd className="font-bold text-[#313030] text-right break-words">{v || '-'}</dd>
              </React.Fragment>
            ))}
          </dl>

          {log.status === 'Ditolak' && log.rejectedReason && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-rose-700">Alasan ditolak</p>
              <p className="mt-0.5 text-xs font-semibold text-rose-800 break-words">{log.rejectedReason}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Bukti</p>
            <ProofPreview url={log.receiptPhotoUrl} title={`Bukti — ${log.desc}`} />
          </div>
        </div>

        {isApprover && log.status === 'Pengajuan' && (
          <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-[#e0e0e0]/70 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={reviewing}
              onClick={() => onReview(log, 'reject')}
              className="h-11 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm font-black inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <X className="h-4 w-4" /> Tolak
            </button>
            <button
              type="button"
              disabled={reviewing}
              onClick={() => onReview(log, 'approve')}
              className="h-11 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-black inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Setujui
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function DashboardPettyCash({
  cashLogs,
  initialPettyCashFloat,
  currentBalance,
  drawerMeta,
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
  const [detailLog, setDetailLog] = useState(null);

  // Semua angka kartu = shift yang sedang buka (dihitung server). Uang di laci sudah dikurangi
  // pengeluaran yang masih Pengajuan; bila ditolak admin, otomatis kembali.
  const totalCashIn = drawerMeta?.approvedIn || 0;
  const totalCashOut = drawerMeta?.approvedOut || 0;
  const netCashInDrawer = Number.isFinite(currentBalance)
    ? currentBalance
    : initialPettyCashFloat + totalCashIn - totalCashOut;

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
      setDetailLog(null);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-gradient-to-tr from-[#420a2c] to-[#5f1340] text-white rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-widest text-rose-200 block">Uang Tunai Di Laci</span>
          <span className="text-2xl font-black block mt-2 text-amber-300">Rp {netCashInDrawer.toLocaleString('id-ID')}</span>
          <span className="text-[10px] text-rose-100/80 block mt-2 font-medium">Laci Shift ({activeOutletName})</span>
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

      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-4 sm:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 pb-4 border-b border-[#e0e0e0]">
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Contoh : Beli tabung gas / Operasional"
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

        {/* Daftar ringkas: tanggal, nama, kategori, nominal — klik baris untuk rincian + bukti */}
        {filteredLogs.length > 0 ? (
          <>
            {/* Desktop / tablet: tabel */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-[#e0e0e0]/80">
              <table className="w-full table-fixed text-left border-collapse">
                <colgroup>
                  <col className="w-[180px]" />
                  <col />
                  <col className="w-[230px]" />
                  <col className="w-[130px]" />
                  <col className="w-[160px]" />
                  <col className="w-[44px]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#f8f8f8] text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                    <th className="py-3 pl-5 pr-3">Tanggal</th>
                    <th className="py-3 px-3">Kategori</th>
                    <th className="py-3 px-3">Pengaju</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Nominal</th>
                    <th className="py-3 pr-4" aria-label="Rincian" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e0e0]/70">
                  {filteredLogs.map((log) => {
                    const isOut = log.type === 'Keluar';
                    const rejected = log.status === 'Ditolak';
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setDetailLog(log)}
                        className="group cursor-pointer hover:bg-[#5f1340]/[0.03] transition-colors"
                        title="Klik untuk melihat rincian & bukti"
                      >
                        <td className="py-3.5 pl-5 pr-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{log.date}</td>
                        <td className="py-3.5 px-3">
                          <span className={`block truncate text-sm font-extrabold ${rejected ? 'text-slate-400 line-through' : 'text-[#313030]'}`}>
                            {log.category || '-'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="block truncate text-xs font-bold text-slate-600">
                            {log.requesterName ? formatEmployeeName(log.requesterName) : '-'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black ${STATUS_STYLE[log.status] || 'bg-slate-100 text-slate-600'}`}>
                            {log.status || 'Pengajuan'}
                          </span>
                        </td>
                        <td className={`py-3.5 px-3 text-right text-sm font-black tabular-nums whitespace-nowrap ${isOut ? 'text-rose-600' : 'text-emerald-600'} ${rejected ? 'opacity-50' : ''}`}>
                          {isOut ? '−' : '+'} {formatRp(log.amount)}
                        </td>
                        <td className="py-3.5 pr-4 text-right">
                          <ChevronRight className="inline h-4 w-4 text-slate-300 group-hover:text-[#5f1340]" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* HP: baris ringkas */}
            <ul className="md:hidden divide-y divide-[#e0e0e0]/70 rounded-2xl border border-[#e0e0e0]/80 overflow-hidden">
              {filteredLogs.map((log) => {
                const isOut = log.type === 'Keluar';
                const rejected = log.status === 'Ditolak';
                return (
                  <li key={log.id}>
                    <button
                      type="button"
                      onClick={() => setDetailLog(log)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[#5f1340]/[0.04] cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`truncate text-sm font-extrabold ${rejected ? 'text-slate-400 line-through' : 'text-[#313030]'}`}>{log.category || '-'}</span>
                          {log.status !== 'Disetujui' && (
                            <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black ${STATUS_STYLE[log.status] || 'bg-slate-100 text-slate-600'}`}>
                              {log.status}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                          {log.date}{log.requesterName ? ` · ${formatEmployeeName(log.requesterName)}` : ''}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-black tabular-nums ${isOut ? 'text-rose-600' : 'text-emerald-600'} ${rejected ? 'opacity-50' : ''}`}>
                        {isOut ? '−' : '+'} {formatRp(log.amount)}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="py-12 text-center text-xs text-slate-400 font-bold">Tidak ada data transaksi kas.</p>
        )}
      </div>

      {detailLog && (
        <PettyCashDetailModal
          log={detailLog}
          isApprover={isApprover}
          reviewing={reviewingId === detailLog.id}
          onReview={handleReview}
          onClose={() => setDetailLog(null)}
        />
      )}
    </>
  );
}
