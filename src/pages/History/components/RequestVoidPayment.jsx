import React, { useMemo, useState } from 'react';
import { formatName, formatEmployeeName } from '../../../utils/FormatName';
import { ProofLink } from '../../../components/ImageLightbox.jsx';
import TablePagination, { usePagination } from './TablePagination.jsx';
import { Banknote, Search, Clock, CheckCircle2, XCircle, FileText, ShieldAlert, User } from 'lucide-react';

const rp = (v) => `Rp ${(Number(v) || 0).toLocaleString('id-ID')}`;
const fmt = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const STATUS = {
  Pending: { label: 'Menunggu Approval', Icon: Clock, cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  Approved: { label: 'Disetujui', Icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  Rejected: { label: 'Ditolak', Icon: XCircle, cls: 'bg-slate-100 text-slate-700 border-slate-300' }
};

function Attachment({ url }) {
  const [broken, setBroken] = useState(false);
  if (!url) return <span className="text-slate-300">-</span>;
  const isPdf = /\.pdf($|\?)/i.test(url);
  return (
    <ProofLink url={url} title="Lihat lampiran" className="inline-flex shrink-0 border border-[#e0e0e0] rounded-lg hover:border-sky-400 cursor-pointer">
      {isPdf || broken ? (
        <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center"><FileText className="h-4 w-4" /></span>
      ) : (
        <img src={url} alt="Lampiran" loading="lazy" onError={() => setBroken(true)} className="w-8 h-8 rounded-lg object-cover" />
      )}
    </ProofLink>
  );
}

/** Tab "Request Hapus Pelunasan" — pembatalan pembayaran terakhir nota, diputuskan di SuperApp. */
export default function RequestVoidPayment({ requests = [] }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('Semua');

  const counts = useMemo(() => {
    const c = { Semua: requests.length, Pending: 0, Approved: 0, Rejected: 0 };
    requests.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [requests]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return requests
      .filter((r) => (filter === 'Semua' || r.status === filter)
        && (!s || [r.order_no, r.customer_name, r.customer_phone, r.reason].some((v) => String(v || '').toLowerCase().includes(s))))
      .sort((a, b) => {
        const pa = a.status === 'Pending' ? 0 : 1;
        const pb = b.status === 'Pending' ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return new Date(b.requested_at || 0) - new Date(a.requested_at || 0);
      });
  }, [requests, q, filter]);

  const pagination = usePagination(filtered, `${q}|${filter}|${requests.length}`);

  const cards = [
    { label: 'Total Pengajuan', value: counts.Semua, Icon: Banknote, box: 'border-[#e0e0e0]', icon: 'bg-sky-50 text-sky-700' },
    { label: 'Menunggu Approval', value: counts.Pending, Icon: Clock, box: 'border-amber-200', icon: 'bg-amber-100 text-amber-800' },
    { label: 'Disetujui', value: counts.Approved, Icon: CheckCircle2, box: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-800' },
    { label: 'Ditolak', value: counts.Rejected, Icon: XCircle, box: 'border-slate-200', icon: 'bg-slate-100 text-slate-600' }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, Icon, box, icon }) => (
          <div key={label} className={`bg-white border ${box} rounded-2xl p-4 shadow-2xs flex items-center gap-3`}>
            <div className={`p-2.5 rounded-xl ${icon}`}><Icon className="h-5 w-5" /></div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-400 truncate">{label}</span>
              <span className="text-xl font-black block text-[#313030]">{value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-2xs flex flex-col gap-4">
        <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl text-[11px] text-sky-900 font-medium">
          <strong>Hapus Pelunasan</strong> membatalkan <strong>pembayaran terakhir</strong> nota tanpa menghapus notanya.
          Setelah disetujui SuperApp, status bayar turun (Lunas → DP / Belum Bayar), revenue berkurang di tanggal bayar aslinya,
          dan pembayaran Potong Saldo Member dikembalikan ke saldo.
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#e0e0e0]/70 pb-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari no. nota / pelanggan / alasan"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-3.5 py-1.5 border border-[#e0e0e0] rounded-xl text-xs font-semibold text-[#313030] outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 bg-slate-50/50"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-[#e0e0e0] overflow-x-auto max-w-full">
            {[['Semua', 'Semua'], ['Pending', 'Menunggu'], ['Approved', 'Disetujui'], ['Rejected', 'Ditolak']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${filter === id ? 'bg-sky-700 text-white shadow-2xs' : 'text-slate-600 hover:text-[#313030]'}`}
              >
                {label} ({counts[id] || 0})
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#e0e0e0]/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f8f8] text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-[#e0e0e0]">
                <th className="py-3 px-4">Nota & Waktu Request</th>
                <th className="py-3 px-4">Pelanggan</th>
                <th className="py-3 px-4">Pembayaran Dihapus</th>
                <th className="py-3 px-4">Alasan</th>
                <th className="py-3 px-4 text-center">Lampiran</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0e0]/70">
              {pagination.pageItems.length > 0 ? pagination.pageItems.map((r) => {
                const st = STATUS[r.status] || STATUS.Pending;
                const StIcon = st.Icon;
                return (
                  <tr key={r.id} className="align-top hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="font-mono font-black block text-xs text-sky-800">{r.order_no}</span>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Req: {fmt(r.requested_at)}</span>
                      {r.requested_by_name && <span className="text-[10px] text-slate-400 font-semibold block">oleh {formatEmployeeName(r.requested_by_name)}</span>}
                    </td>
                    <td className="py-4 px-4 min-w-[9rem]">
                      <span className="font-extrabold text-[#313030] text-xs flex items-center gap-1.5">
                        <User className="h-3 w-3 text-slate-400 shrink-0" />
                        {formatName(r.customer_name || '-')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 pl-[18px]">{r.customer_phone}</span>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="font-black text-[#313030] text-sm block">{rp(r.amount)}</span>
                      <span className="text-[10px] text-slate-500 font-semibold block">{r.log_type} · {r.payment_method || '-'}</span>
                      <span className="text-[10px] text-slate-400 font-semibold block">dibayar {fmt(r.paid_at)}</span>
                    </td>
                    <td className="py-4 px-4 min-w-[14rem] max-w-sm">
                      <div className="p-2.5 bg-sky-50/60 border border-sky-100 rounded-xl text-[#313030] text-xs leading-relaxed font-semibold break-words">
                        &ldquo;{r.reason}&rdquo;
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center"><Attachment url={r.attachment_url} /></td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span className={`${st.cls} border font-black text-[10px] px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-2xs ${r.status === 'Pending' ? 'animate-pulse' : ''}`}>
                        <StIcon className="h-3 w-3" />
                        <span>{st.label}</span>
                      </span>
                      {r.reviewed_by_name && <span className="block text-[10px] text-slate-500 font-semibold mt-1.5">oleh {formatEmployeeName(r.reviewed_by_name)}</span>}
                      {r.reviewed_at && <span className="block text-[10px] text-slate-400 font-semibold">{fmt(r.reviewed_at)}</span>}
                      {r.review_notes && <span className="block text-[10px] text-slate-600 italic mt-1 max-w-[12rem] mx-auto whitespace-normal">&ldquo;{r.review_notes}&rdquo;</span>}
                      {r.status === 'Approved' && r.deposit_mutation_id && <span className="block text-[10px] text-sky-700 font-bold mt-1">Saldo member dikembalikan</span>}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="6" className="py-14 text-center text-slate-400">
                    <ShieldAlert className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-xs text-[#313030]">Belum ada pengajuan hapus pelunasan</p>
                    <p className="text-[11px] mt-0.5">Ajukan dari tombol hapus nota pada nota yang sudah dibayar</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination pagination={pagination} accent="bg-sky-700" accentSoft="bg-sky-50 text-sky-700 hover:bg-sky-100" />
      </div>
    </div>
  );
}
