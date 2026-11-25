import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import ImageLightbox from '../../../components/ImageLightbox.jsx';
import { formatName, formatEmployeeName } from '../../../utils/FormatName';
import TablePagination, { usePagination } from './TablePagination.jsx';
import {
  RefreshCcw,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ChevronRight,
  X,
  FileText,
  ImageOff,
  Maximize2
} from 'lucide-react';

const TYPE_BADGE = {
  Refund: 'bg-sky-50 text-sky-800 border-sky-200',
  Deposit: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Tips: 'bg-amber-50 text-amber-800 border-amber-200'
};

const STATUS_META = {
  Approved: { label: 'Disetujui', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', Icon: CheckCircle2 },
  Rejected: { label: 'Ditolak', cls: 'bg-rose-100 text-rose-800 border-rose-300', Icon: XCircle },
  Pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-900 border-amber-300', Icon: Clock }
};

const formatWhen = (value) => (value
  ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
  : '-');
const formatRp = (n) => `Rp ${(parseFloat(n) || 0).toLocaleString('id-ID')}`;
const isPdf = (url) => /\.pdf(\?|$)/i.test(String(url || ''));

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.Pending;
  const { Icon } = meta;
  return (
    <span className={`border font-black text-[10px] px-2.5 py-1 rounded-full inline-flex items-center gap-1 whitespace-nowrap ${meta.cls}`}>
      <Icon className="h-3 w-3" /> {meta.label}
    </span>
  );
}

/** Pratinjau bukti di dalam modal rincian; ketuk untuk layar penuh. */
function ProofPreview({ url, label }) {
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);
  if (!url) return null;

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold text-slate-500">{label}</p>
      {isPdf(url) ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#e0e0e0] text-xs font-black text-sky-700 hover:border-sky-400"
        >
          <FileText className="h-4 w-4" /> Buka PDF
        </a>
      ) : failed ? (
        <div className="rounded-xl border border-dashed border-[#e0e0e0] bg-slate-50 py-5 flex flex-col items-center gap-1 text-center">
          <ImageOff className="h-6 w-6 text-slate-300" />
          <p className="text-xs font-bold text-slate-500">Gambar tidak dapat dimuat</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="group relative block w-full overflow-hidden rounded-xl border border-[#e0e0e0] bg-slate-50 cursor-zoom-in"
          title="Perbesar"
        >
          <img src={url} alt={label} onError={() => setFailed(true)} className="w-full max-h-56 object-contain" />
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-bold text-white">
            <Maximize2 className="h-3 w-3" /> Perbesar
          </span>
        </button>
      )}
      {zoom && <ImageLightbox src={url} alt={label} title={label} onClose={() => setZoom(false)} />}
    </div>
  );
}

/** Modal rincian pengajuan: alasan, bukti, dan hasil keputusan admin. HP: bottom sheet. */
function RefundDetailModal({ r, onClose }) {
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

  const facts = [
    ['Pelanggan', `${formatName(r.customer_name)}${r.customer_phone ? ` · ${r.customer_phone}` : ''}`],
    ['Tagihan nota', formatRp(r.grand_total)],
    ['Diajukan', formatWhen(r.requested_at)],
    ['Oleh', r.requested_by_name ? formatEmployeeName(r.requested_by_name) : '-'],
    ...(r.source === 'Hapus Nota' ? [['Sumber', 'Dari Hapus Nota']] : []),
    ...(r.reviewed_at ? [['Diputuskan', formatWhen(r.reviewed_at)]] : [])
  ];
  const hasProof = r.payment_proof_url || r.attachment_url;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-[#313030]/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label="Rincian pengajuan" className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <div className="sticky top-0 z-10 bg-white px-5 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-[#e0e0e0]/70">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${TYPE_BADGE[r.refund_type] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                {r.refund_type}
              </span>
              <StatusBadge status={r.status} />
            </div>
            <p className="mt-2 font-mono text-sm font-black text-sky-700 break-all">{r.order_no}</p>
            <p className="mt-0.5 text-2xl font-black text-[#313030] tabular-nums">{formatRp(r.amount)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="shrink-0 h-9 w-9 grid place-items-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
            {facts.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="font-bold text-slate-400">{k}</dt>
                <dd className="font-bold text-[#313030] text-right break-words">{v}</dd>
              </React.Fragment>
            ))}
          </dl>

          <div>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Alasan</p>
            <p className="rounded-xl bg-slate-50 border border-[#e0e0e0]/80 px-3 py-2.5 text-sm font-semibold text-[#313030] whitespace-pre-line break-words">
              {r.reason || '-'}
            </p>
          </div>

          {hasProof && (
            <div className="flex flex-col gap-3">
              <p className="-mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Bukti</p>
              <ProofPreview url={r.payment_proof_url} label="Bukti bayar" />
              <ProofPreview url={r.attachment_url} label="Bukti tambahan" />
            </div>
          )}

          {r.status === 'Approved' && (r.approve_notes || r.approve_path) && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-3 flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Keputusan admin</p>
              {r.approve_notes && <p className="text-xs font-semibold text-slate-700 break-words">{r.approve_notes}</p>}
              <ProofPreview url={r.approve_path} label="Bukti pembayaran refund" />
            </div>
          )}

          {r.status === 'Rejected' && r.decline_notes && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-rose-700">Alasan ditolak</p>
              <p className="mt-0.5 text-xs font-semibold text-rose-800 break-words">{r.decline_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Tab Request Refund & Deposit: daftar pengajuan di tr_transaction_refund (Phase 13). */
export default function RequestRefundTransaction({ outletId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua'); // Semua | Pending | Approved | Rejected
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios.get('/api/transactions/refunds', { params: { outlet_id: outletId || undefined } })
      .then((res) => {
        if (!cancelled && res.data?.success) setRows(res.data.data || []);
      })
      .catch((err) => console.error('Gagal memuat pengajuan refund:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [outletId]);

  const countBy = (status) => rows.filter((r) => r.status === status).length;

  // Pending dulu (perlu perhatian), lalu pengajuan terbaru.
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return rows
      .filter((r) => {
        const matchesSearch = !q
          || String(r.order_no || '').toLowerCase().includes(q)
          || String(r.customer_name || '').toLowerCase().includes(q)
          || String(r.customer_phone || '').includes(q)
          || String(r.reason || '').toLowerCase().includes(q);
        return matchesSearch && (statusFilter === 'Semua' || r.status === statusFilter);
      })
      .sort((a, b) => {
        const pa = a.status === 'Pending' ? 0 : 1;
        const pb = b.status === 'Pending' ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return new Date(b.requested_at || 0) - new Date(a.requested_at || 0);
      });
  }, [rows, searchQuery, statusFilter]);

  const pagination = usePagination(filtered, `${searchQuery}|${statusFilter}|${rows.length}`);

  const cards = [
    { label: 'Total Pengajuan', value: rows.length, note: 'Refund / Deposit / Tips', Icon: RefreshCcw, box: 'border-[#e0e0e0]', icon: 'bg-sky-50 text-sky-700', text: 'text-[#313030]' },
    { label: 'Pending Approval', value: countBy('Pending'), note: 'Menunggu admin Alora SuperApp', Icon: Clock, box: 'border-amber-200', icon: 'bg-amber-100 text-amber-800', text: 'text-amber-900' },
    { label: 'Disetujui', value: countBy('Approved'), note: 'Sudah diproses admin', Icon: CheckCircle2, box: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-900' },
    { label: 'Ditolak', value: countBy('Rejected'), note: 'Lihat catatan admin', Icon: XCircle, box: 'border-rose-200', icon: 'bg-rose-100 text-rose-700', text: 'text-rose-800' }
  ];

  const emptyState = (
    <div className="py-14 text-center text-slate-400">
      <ShieldAlert className="h-10 w-10 mx-auto text-slate-300 mb-2" />
      <p className="font-bold text-xs text-[#313030]">Tidak ada pengajuan yang ditemukan</p>
      <p className="text-[11px] mt-0.5">Ajukan lewat tombol Refund di kolom aksi tab Riwayat Transaksi</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, note, Icon, box, icon, text }) => (
          <div key={label} className={`bg-white border ${box} rounded-2xl p-5 shadow-2xs flex items-center gap-4`}>
            <div className={`p-3 rounded-xl ${icon}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
              <span className={`text-xl font-black block mt-0.5 ${text}`}>{value} Pengajuan</span>
              <span className="text-[10px] text-slate-400 font-medium">{note}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-4 sm:p-5 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#e0e0e0]/70 pb-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari no. nota / nama / no. WA"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3.5 border border-[#e0e0e0] rounded-xl text-sm font-medium text-[#313030] outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 bg-white"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-[#e0e0e0] overflow-x-auto max-w-full">
            {[
              { id: 'Semua', label: `Semua (${rows.length})` },
              { id: 'Pending', label: `Pending (${countBy('Pending')})` },
              { id: 'Approved', label: `Disetujui (${countBy('Approved')})` },
              { id: 'Rejected', label: `Ditolak (${countBy('Rejected')})` }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-sky-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-[#313030]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="py-12 text-center text-xs text-slate-400 font-bold">Memuat pengajuan…</p>
        ) : filtered.length === 0 ? (
          emptyState
        ) : (
          <>
            {/* Desktop / tablet: tabel ringkas — alasan & bukti ada di modal rincian */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-[#e0e0e0]/80">
              <table className="w-full table-fixed text-left border-collapse">
                <colgroup>
                  <col className="w-[170px]" />
                  <col />
                  <col className="w-[110px]" />
                  <col className="w-[150px]" />
                  <col className="w-[130px]" />
                  <col className="w-[44px]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#f8f8f8] text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                    <th className="py-3 pl-5 pr-3">Tanggal</th>
                    <th className="py-3 px-3">Nota &amp; Pelanggan</th>
                    <th className="py-3 px-3">Jenis</th>
                    <th className="py-3 px-3 text-right">Nominal</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 pr-4" aria-label="Rincian" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e0e0]/70">
                  {pagination.pageItems.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setDetail(r)}
                      className="group cursor-pointer hover:bg-sky-50/40 transition-colors"
                      title="Klik untuk melihat alasan & bukti"
                    >
                      <td className="py-3.5 pl-5 pr-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{formatWhen(r.requested_at)}</td>
                      <td className="py-3.5 px-3 min-w-0">
                        <p className="truncate font-mono text-xs font-black text-sky-700">{r.order_no}</p>
                        <p className="truncate text-sm font-extrabold text-[#313030]">{formatName(r.customer_name)}</p>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${TYPE_BADGE[r.refund_type] || ''}`}>
                          {r.refund_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right text-sm font-black text-[#313030] tabular-nums whitespace-nowrap">{formatRp(r.amount)}</td>
                      <td className="py-3.5 px-3 text-center"><StatusBadge status={r.status} /></td>
                      <td className="py-3.5 pr-4 text-right">
                        <ChevronRight className="inline h-4 w-4 text-slate-300 group-hover:text-sky-700" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* HP: baris ringkas */}
            <ul className="md:hidden divide-y divide-[#e0e0e0]/70 rounded-2xl border border-[#e0e0e0]/80 overflow-hidden">
              {pagination.pageItems.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-sky-50/60 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-sm font-extrabold text-[#313030]">{formatName(r.customer_name)}</span>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[9px] font-black ${TYPE_BADGE[r.refund_type] || ''}`}>
                          {r.refund_type}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                        <span className="font-mono text-sky-700">{r.order_no}</span> · {formatWhen(r.requested_at)}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-sm font-black text-[#313030] tabular-nums">{formatRp(r.amount)}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <TablePagination
          pagination={pagination}
          accent="bg-sky-600"
          accentSoft="bg-sky-50 text-sky-700 hover:bg-sky-100"
        />
      </div>

      {detail && <RefundDetailModal r={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
