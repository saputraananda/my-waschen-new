import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ProofLink } from '../../../components/ImageLightbox.jsx';
import { formatName, formatEmployeeName } from '../../../utils/FormatName';
import {
  RefreshCcw,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Paperclip
} from 'lucide-react';

const TYPE_BADGE = {
  Refund: 'bg-sky-50 text-sky-800 border-sky-200',
  Deposit: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Tips: 'bg-amber-50 text-amber-800 border-amber-200'
};

const formatWhen = (value) => (value
  ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
  : '-');

/** Tab Request Refund: daftar pengajuan di tr_transaction_refund (Phase 13). */
export default function RequestRefundTransaction({ outletId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua'); // Semua | Pending | Approved | Rejected

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

  const q = searchQuery.toLowerCase();
  const filtered = rows.filter((r) => {
    const matchesSearch = !q
      || String(r.order_no || '').toLowerCase().includes(q)
      || String(r.customer_name || '').toLowerCase().includes(q)
      || String(r.customer_phone || '').includes(q)
      || String(r.reason || '').toLowerCase().includes(q);
    return matchesSearch && (statusFilter === 'Semua' || r.status === statusFilter);
  });

  const cards = [
    { label: 'Total Pengajuan', value: rows.length, note: 'Refund / Deposit / Tips', Icon: RefreshCcw, box: 'border-[#e0e0e0]', icon: 'bg-sky-50 text-sky-700', text: 'text-[#313030]' },
    { label: 'Pending Approval', value: countBy('Pending'), note: 'Menunggu admin Alora SuperApp', Icon: Clock, box: 'border-amber-200', icon: 'bg-amber-100 text-amber-800', text: 'text-amber-900' },
    { label: 'Disetujui', value: countBy('Approved'), note: 'Sudah diproses admin', Icon: CheckCircle2, box: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-900' },
    { label: 'Ditolak', value: countBy('Rejected'), note: 'Lihat catatan admin', Icon: XCircle, box: 'border-rose-200', icon: 'bg-rose-100 text-rose-700', text: 'text-rose-800' }
  ];

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

      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#e0e0e0]/70 pb-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Contoh : WS-0826001 / Budi"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-1.5 border border-[#e0e0e0] rounded-xl text-xs font-semibold text-[#313030] outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 bg-slate-50/50"
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f8f8] text-slate-400 font-extrabold uppercase text-[10px] border-b border-[#e0e0e0]">
                <th className="py-3.5 px-4">No. Nota & Waktu Request</th>
                <th className="py-3.5 px-4">Pelanggan</th>
                <th className="py-3.5 px-4">Jenis</th>
                <th className="py-3.5 px-4">Alasan / Bukti</th>
                <th className="py-3.5 px-4 text-right">Tagihan</th>
                <th className="py-3.5 px-4 text-right">Nominal</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0e0]/70 font-semibold">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 font-bold">Memuat pengajuan refund...</td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors align-top">
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-black text-sky-700 block text-xs">{r.order_no}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Req: {formatWhen(r.requested_at)}</span>
                      {r.requested_by_name && (
                        <span className="text-[10px] text-slate-400 block">oleh {formatEmployeeName(r.requested_by_name)}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-[#313030] text-xs block">{formatName(r.customer_name)}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{r.customer_phone}</span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${TYPE_BADGE[r.refund_type] || ''}`}>
                        {r.refund_type}
                      </span>
                      {r.source === 'Hapus Nota' && (
                        <span className="block text-[10px] text-rose-600 font-bold mt-1">dari Hapus Nota</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="p-2.5 bg-sky-50/60 border border-sky-100 rounded-xl text-[#313030] text-xs leading-relaxed">
                        &quot;{r.reason}&quot;
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {r.payment_proof_url && (
                          <ProofLink url={r.payment_proof_url} title={`Bukti Bayar — ${r.order_no || ''}`} className="text-[10px] font-bold text-sky-700 hover:underline inline-flex items-center gap-1 cursor-pointer">
                            <Paperclip className="h-3 w-3" /> Bukti bayar
                          </ProofLink>
                        )}
                        {r.attachment_url && (
                          <ProofLink url={r.attachment_url} title={`Bukti Tambahan — ${r.order_no || ''}`} className="text-[10px] font-bold text-sky-700 hover:underline inline-flex items-center gap-1 cursor-pointer">
                            <Paperclip className="h-3 w-3" /> Bukti tambahan
                          </ProofLink>
                        )}
                      </div>
                      {r.status === 'Approved' && (r.approve_path || r.approve_notes) && (
                        <div className="mt-1.5 rounded-lg border border-emerald-100 bg-emerald-50/60 px-2 py-1.5">
                          <p className="text-[10px] font-black text-emerald-700">Disetujui admin</p>
                          {r.approve_path && (
                            <ProofLink url={r.approve_path} title={`Bukti Pembayaran Refund — ${r.order_no || ''}`} className="text-[10px] font-bold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer">
                              <Paperclip className="h-3 w-3" /> Bukti pembayaran refund
                            </ProofLink>
                          )}
                          {r.approve_notes && <p className="text-[10px] text-slate-600 font-semibold">Catatan admin: {r.approve_notes}</p>}
                        </div>
                      )}
                      {r.status === 'Rejected' && r.decline_notes && (
                        <p className="text-[10px] text-rose-700 font-bold mt-1.5">Alasan penolakan: {r.decline_notes}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-[#313030] text-sm whitespace-nowrap">
                      Rp {(parseFloat(r.grand_total) || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-sky-700 text-sm whitespace-nowrap">
                      Rp {(parseFloat(r.amount) || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {r.status === 'Approved' ? (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[10px] px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Disetujui
                        </span>
                      ) : r.status === 'Rejected' ? (
                        <span className="bg-rose-100 text-rose-800 border border-rose-300 font-black text-[10px] px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-2xs">
                          <XCircle className="h-3 w-3 text-rose-600" /> Ditolak
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-2xs animate-pulse">
                          <Clock className="h-3 w-3 text-amber-700" /> Pending
                        </span>
                      )}
                      {r.reviewed_at && (
                        <span className="block text-[10px] text-slate-400 mt-1">{formatWhen(r.reviewed_at)}</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <ShieldAlert className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-xs text-[#313030]">Tidak ada pengajuan refund yang ditemukan</p>
                    <p className="text-[11px] mt-0.5">Ajukan lewat tombol Refund di kolom aksi tab Riwayat Transaksi</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
