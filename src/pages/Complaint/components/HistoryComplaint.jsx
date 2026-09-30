import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Inbox, Search, X } from 'lucide-react';

const authCfg = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });

const BADGE = {
  Request: 'bg-orange-50 text-orange-700 border-orange-200',
  Open: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  'On Progress': 'bg-amber-50 text-amber-700 border-amber-200',
  'Waiting Customer': 'bg-sky-50 text-sky-700 border-sky-200',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Closed: 'bg-slate-100 text-slate-600 border-slate-200',
  Archive: 'bg-rose-50 text-rose-700 border-rose-200'
};

const DOT = {
  Request: 'bg-orange-500',
  Open: 'bg-fuchsia-500',
  'On Progress': 'bg-amber-500',
  'Waiting Customer': 'bg-sky-500',
  Resolved: 'bg-emerald-500',
  Closed: 'bg-slate-400',
  Archive: 'bg-rose-500'
};

const STATUS_ORDER = ['Request', 'Open', 'On Progress', 'Waiting Customer', 'Resolved', 'Closed', 'Archive'];

function formatWhen(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fileUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  let clean = String(path).replace(/^\/+/, '');
  if (!clean.startsWith('assets/')) clean = `assets/${clean}`;
  const origin = (import.meta.env.VITE_WASCHEN_POS_PUBLIC_BASE_URL || 'https://pos.mywaschen.com').replace(/\/$/, '');
  return `${origin}/uploads/${clean}`;
}

function StatusPill({ progress }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black ${BADGE[progress] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[progress] || 'bg-slate-400'}`} />
      {progress}
    </span>
  );
}

function DocLink({ doc }) {
  const href = fileUrl(doc.file_path);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="block text-xs font-bold text-[#5f1340] hover:underline truncate">
      {doc.original_name || 'Dokumen'}
    </a>
  );
}

function DetailModal({ detail, loading, error, onClose }) {
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <div className="fixed inset-0 z-[100] bg-[#313030]/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl border border-[#e0e0e0] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#e0e0e0] px-5 py-4 flex items-start justify-between gap-3 rounded-t-3xl">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Detail Komplain</p>
            <h3 className="text-base font-black text-[#313030] truncate">
              {detail ? (String(detail.nota_number || '').trim() === '0' || !detail.nota_number ? '-' : detail.nota_number) : 'Memuat…'}
            </h3>
            {detail?.complaint_name && <p className="text-xs text-slate-500 font-semibold">{detail.complaint_name}</p>}
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-xl hover:bg-[#f8f8f8] flex items-center justify-center cursor-pointer" aria-label="Tutup">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {loading && <p className="text-xs font-bold text-slate-400 py-8 text-center">Memuat detail…</p>}
          {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          {detail && (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-500">{formatWhen(detail.submitted_at || detail.created_at)}</span>
                <StatusPill progress={detail.progress} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Tipe', detail.type_name],
                  ['Kategori', detail.category_name],
                  ['Topik', detail.topic_name],
                  ['Qty', detail.qty]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-[#f8f8f8] border border-[#e0e0e0] px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
                    <p className="text-xs font-black text-[#313030] mt-0.5">{value || '-'}</p>
                  </div>
                ))}
              </div>

              {(detail.pic_name || (detail.deduction && detail.deduction !== 'None')) && (
                <div className="grid grid-cols-2 gap-3">
                  {detail.pic_name && (
                    <div className="rounded-xl bg-[#f8f8f8] border border-[#e0e0e0] px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">PIC</p>
                      <p className="text-xs font-black text-[#313030] mt-0.5">{detail.pic_name}</p>
                    </div>
                  )}
                  {detail.deduction && detail.deduction !== 'None' && (
                    <div className="rounded-xl bg-[#f8f8f8] border border-[#e0e0e0] px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Potongan</p>
                      <p className="text-xs font-black text-[#313030] mt-0.5">{detail.deduction}</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Kronologi</p>
                <p className="text-xs font-medium text-[#313030] leading-relaxed whitespace-pre-wrap">{detail.description || '-'}</p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Dokumen</p>
                {detail.documents?.length ? (
                  <div className="flex flex-col gap-1.5">
                    {detail.documents.map((doc) => <DocLink key={doc.doc_id} doc={doc} />)}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-semibold">Tidak ada dokumen</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Progres</p>
                {detail.logs?.length ? (
                  <ol className="flex flex-col gap-3 border-l border-[#e0e0e0] ml-1.5 pl-4">
                    {detail.logs.map((log) => (
                      <li key={log.log_id} className="relative">
                        <span className={`absolute -left-[21px] top-1 h-2 w-2 rounded-full ${DOT[log.progress] || 'bg-slate-400'}`} />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-[#313030]">{log.progress}</span>
                          <span className="text-[10px] font-semibold text-slate-400">{formatWhen(log.logged_at)}</span>
                        </div>
                        {log.note && <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{log.note}</p>}
                        {log.pic_name && <p className="text-[11px] text-slate-400 mt-0.5">PIC: {log.pic_name}</p>}
                        {log.documents?.length > 0 && (
                          <div className="mt-1 flex flex-col gap-1">
                            {log.documents.map((doc, i) => <DocLink key={`${log.log_id}-${i}`} doc={doc} />)}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-slate-400 font-semibold">Belum ada catatan progres</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HistoryComplaint({ activeOutletId, activeOutletName, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    if (!activeOutletId || activeOutletId === 'Semua') {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    axios.get('/api/complaints', { ...authCfg(), params: { outlet_id: activeOutletId } })
      .then((res) => { if (!cancelled) setRows(res.data?.data || []); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Gagal memuat riwayat'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeOutletId, refreshKey]);

  const openDetail = (id) => {
    setOpenId(id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    axios.get(`/api/complaints/${id}`, { ...authCfg(), params: { outlet_id: activeOutletId } })
      .then((res) => setDetail(res.data?.data || null))
      .catch((err) => setDetailError(err.response?.data?.message || 'Gagal memuat detail'))
      .finally(() => setDetailLoading(false));
  };

  if (!activeOutletId || activeOutletId === 'Semua') {
    return (
      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-14 text-center">
        <Inbox className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-black text-[#313030]">Pilih outlet dulu</p>
        <p className="text-xs text-slate-400 mt-1">Riwayat komplain hanya tampil per cabang — pilih outlet spesifik di header.</p>
      </div>
    );
  }

  const filtered = rows.filter((r) => {
    const matchStatus = !statusFilter || r.progress === statusFilter;
    const q = query.trim().toLowerCase();
    const matchQuery = !q
      || String(r.nota_number || '').toLowerCase().includes(q)
      || String(r.complaint_name || '').toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  const statusCount = (s) => rows.filter((r) => r.progress === s).length;

  const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [query, statusFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full lg:max-w-xs">
        <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#e0e0e0] rounded-xl text-xs font-bold text-[#313030] outline-none focus:border-[#5f1340] focus:ring-1 focus:ring-[#5f1340]"
          placeholder="Cari nota atau customer…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            statusFilter === '' ? 'border-[#5f1340] bg-[#5f1340] text-white shadow-lg shadow-[#5f1340]/25' : 'border-[#e0e0e0] bg-white hover:border-[#5f1340]/40'
          }`}
        >
          <p className={`text-[10px] font-black uppercase tracking-wider ${statusFilter === '' ? 'text-white/70' : 'text-slate-400'}`}>Semua</p>
          <p className="text-2xl font-black mt-1">{rows.length}</p>
        </button>
        {STATUS_ORDER.filter((s) => statusCount(s) > 0).map((s) => {
          const active = statusFilter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(active ? '' : s)}
              className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                active ? 'border-[#5f1340] bg-[#5f1340] text-white shadow-lg shadow-[#5f1340]/25' : 'border-[#e0e0e0] bg-white hover:border-[#5f1340]/40'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${DOT[s]}`} />
                <p className={`text-[10px] font-black uppercase tracking-wider truncate ${active ? 'text-white/70' : 'text-slate-400'}`}>{s}</p>
              </div>
              <p className="text-2xl font-black mt-1">{statusCount(s)}</p>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-3xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e0e0e0]">
          <h2 className="text-sm font-black text-[#313030]">Riwayat Komplain</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {activeOutletName || 'Cabang ini'} · {filtered.length} dari {rows.length} data · klik baris untuk detail
          </p>
        </div>

        {loading ? (
          <p className="px-5 py-14 text-center text-xs font-bold text-slate-400">Memuat riwayat…</p>
        ) : error ? (
          <p className="px-5 py-14 text-center text-xs font-bold text-rose-600">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center text-slate-400">
            <Inbox className="h-9 w-9 mx-auto mb-3 text-slate-300" />
            <p className="text-xs font-black text-[#313030]">
              {rows.length === 0 ? 'Belum ada komplain di cabang ini' : 'Tidak ada hasil untuk filter ini'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#f8f8f8] text-slate-400 font-extrabold uppercase text-[10px] border-b border-[#e0e0e0]">
                  <th className="py-3.5 px-5 text-center">No</th>
                  <th className="py-3.5 px-4 text-center">Tanggal</th>
                  <th className="py-3.5 px-4">Nota</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4 text-center">Sumber</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e0e0e0]/70">
                {pageRows.map((row, i) => (
                  <tr
                    key={row.complaint_id}
                    onClick={() => openDetail(row.complaint_id)}
                    className="hover:bg-[#f8f8f8] cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-5 font-bold text-slate-400 text-center">{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-600 text-center">
                      {formatWhen(row.submitted_at)}
                    </td>
                    <td className="py-3.5 px-4 font-black text-[#313030] tracking-wide">
                      {String(row.nota_number || '').trim() === '0' || !row.nota_number ? '-' : row.nota_number}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600">{row.complaint_name}</td>
                    <td className="py-3.5 px-4 text-center">
                      {row.source ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${row.source === 'Smartlink' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'}`}>
                          {row.source}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-bold">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-center"><StatusPill progress={row.progress} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > PAGE_SIZE && (
          <div className="px-5 py-3.5 border-t border-[#e0e0e0] flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-slate-400">
              Halaman {safePage} dari {totalPages} · {filtered.length} data
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage <= 1}
                className="px-3 py-1.5 rounded-xl border border-[#e0e0e0] text-[10px] font-black text-slate-500 hover:bg-[#f8f8f8] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="px-3 py-1.5 rounded-xl bg-[#5f1340] text-white text-[10px] font-black">{safePage}</span>
              <button
                type="button"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 rounded-xl border border-[#e0e0e0] text-[10px] font-black text-slate-500 hover:bg-[#f8f8f8] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {openId != null && (
        <DetailModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={() => { setOpenId(null); setDetail(null); }}
        />
      )}
    </div>
  );
}
