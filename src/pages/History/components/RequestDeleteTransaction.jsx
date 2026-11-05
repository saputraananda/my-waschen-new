import React, { useMemo, useState } from 'react';
import { formatName, formatEmployeeName } from '../../../utils/FormatName';
import { ProofLink } from '../../../components/ImageLightbox.jsx';
import TablePagination, { usePagination } from './TablePagination.jsx';
import {
  Trash2,
  Search,
  Clock,
  CheckCircle2,
  FileText,
  ShieldAlert,
  User,
  Store
} from 'lucide-react';

const isApprovedStatus = (s) => s === 1 || s === '1';
const isPendingStatus = (s) => s === 0 || s === '0' || s === null || s === undefined;

// Approve di SuperApp menempelkan "[APPROVED by KODE — NAMA @ ISO]" ke delete_reason; dipisah agar tampil rapi.
const APPROVE_TAG = /\s*\[APPROVED by (.+?) — (.+?) @ (.+?)\]/;

function splitReason(raw) {
  const text = String(raw || '');
  const m = text.match(APPROVE_TAG);
  const reason = text.replace(new RegExp(APPROVE_TAG, 'g'), '').trim();
  if (!m) return { reason, approver: null, approvedAt: null };
  const when = new Date(m[3]);
  return {
    reason,
    approver: m[2],
    approvedAt: Number.isNaN(when.getTime())
      ? null
      : when.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
  };
}

function AttachmentChip({ url }) {
  const [broken, setBroken] = useState(false);
  const isPdf = /\.pdf($|\?)/i.test(url);
  return (
    <ProofLink
      url={url}
      title="Lihat lampiran pengajuan"
      className="inline-flex shrink-0 border border-[#e0e0e0] rounded-lg hover:border-rose-400 cursor-pointer"
    >
      {isPdf || broken ? (
        <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
          <FileText className="h-4 w-4" />
        </span>
      ) : (
        <img
          src={url}
          alt="Lampiran hapus nota"
          loading="lazy"
          onError={() => setBroken(true)}
          className="w-8 h-8 rounded-lg object-cover"
        />
      )}
    </ProofLink>
  );
}

export default function RequestDeleteTransaction({ transactions }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('Semua'); // Semua | Pending | Approved

  const deleteRequests = useMemo(() => transactions.filter((t) => t.isDeleteRequested), [transactions]);
  const pendingCount = deleteRequests.filter((t) => isPendingStatus(t.deleteApprovalStatus)).length;
  const approvedCount = deleteRequests.filter((t) => isApprovedStatus(t.deleteApprovalStatus)).length;

  // Pending dulu (perlu perhatian), lalu pengajuan terbaru.
  const filteredRequests = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return deleteRequests
      .filter((t) => {
        const matchesSearch = !q
          || t.id.toLowerCase().includes(q)
          || t.customerName.toLowerCase().includes(q)
          || t.customerPhone.includes(q)
          || (t.deleteReason && t.deleteReason.toLowerCase().includes(q));
        const matchesApproval = approvalFilter === 'Semua'
          || (approvalFilter === 'Pending' && isPendingStatus(t.deleteApprovalStatus))
          || (approvalFilter === 'Approved' && isApprovedStatus(t.deleteApprovalStatus));
        return matchesSearch && matchesApproval;
      })
      .sort((a, b) => {
        const pa = isPendingStatus(a.deleteApprovalStatus) ? 0 : 1;
        const pb = isPendingStatus(b.deleteApprovalStatus) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return new Date(b.deleteRequestedRaw || 0) - new Date(a.deleteRequestedRaw || 0);
      });
  }, [deleteRequests, searchQuery, approvalFilter]);

  const pagination = usePagination(filteredRequests, `${searchQuery}|${approvalFilter}|${deleteRequests.length}`);

  const cards = [
    { label: 'Total Request Delete', value: deleteRequests.length, note: 'Pengajuan hapus nota', Icon: Trash2, box: 'border-[#e0e0e0]', icon: 'bg-rose-50 text-rose-700', text: 'text-[#313030]', labelText: 'text-slate-400' },
    { label: 'Pending Approval', value: pendingCount, note: 'Menunggu konfirmasi App Utama', Icon: Clock, box: 'border-amber-200 bg-gradient-to-r from-amber-50/40 via-white to-amber-50/20', icon: 'bg-amber-100 text-amber-800', text: 'text-amber-900', labelText: 'text-amber-800' },
    { label: 'Approved / Disetujui', value: approvedCount, note: 'Sudah disetujui admin, keluar dari pendapatan', Icon: CheckCircle2, box: 'border-emerald-200 bg-gradient-to-r from-emerald-50/40 via-white to-emerald-50/20', icon: 'bg-emerald-100 text-emerald-800', text: 'text-emerald-900', labelText: 'text-emerald-800' }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(({ label, value, note, Icon, box, icon, text, labelText }) => (
          <div key={label} className={`bg-white border ${box} rounded-2xl p-5 shadow-2xs flex items-center gap-4`}>
            <div className={`p-3 rounded-xl ${icon}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${labelText}`}>{label}</span>
              <span className={`text-xl font-black block mt-0.5 ${text}`}>{value} <span className="text-sm font-bold">Nota</span></span>
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
              placeholder="Cari no. nota / pelanggan / alasan"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-1.5 border border-[#e0e0e0] rounded-xl text-xs font-semibold text-[#313030] outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-[#e0e0e0] overflow-x-auto max-w-full">
            {[
              { id: 'Semua', label: `Semua (${deleteRequests.length})` },
              { id: 'Pending', label: `Pending (${pendingCount})` },
              { id: 'Approved', label: `Approved (${approvedCount})` }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setApprovalFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  approvalFilter === tab.id
                    ? 'bg-rose-600 text-white shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-[#313030]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#e0e0e0]/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f8f8] text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-[#e0e0e0]">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nota & Waktu Request</th>
                <th className="py-3 px-4">Pelanggan</th>
                <th className="py-3 px-4">Outlet / Kasir</th>
                <th className="py-3 px-4">Alasan Pengajuan Hapus</th>
                <th className="py-3 px-4 text-center">Lampiran</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0e0]/70">
              {pagination.pageItems.length > 0 ? (
                pagination.pageItems.map((t, idx) => {
                  const approved = isApprovedStatus(t.deleteApprovalStatus);
                  const { reason, approver, approvedAt } = splitReason(t.deleteReason);
                  return (
                    <tr key={t.id} className="align-top hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 text-center text-slate-400 font-bold">{pagination.start + idx + 1}</td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`font-mono font-black block text-xs ${approved ? 'text-slate-500 line-through decoration-slate-300' : 'text-rose-700'}`}>{t.id}</span>
                        <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Req: {t.deleteRequestedAt || t.createdAt}</span>
                      </td>
                      <td className="py-4 px-4 min-w-[9rem]">
                        <span className="font-extrabold text-[#313030] text-xs flex items-center gap-1.5">
                          <User className="h-3 w-3 text-slate-400 shrink-0" />
                          {formatName(t.customerName)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 pl-[18px]">{t.customerPhone}</span>
                      </td>
                      <td className="py-4 px-4 min-w-[10rem]">
                        <span className="text-slate-700 font-bold flex items-center gap-1.5">
                          <Store className="h-3 w-3 text-slate-400 shrink-0" />
                          {t.branch}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 pl-[18px]">{formatEmployeeName(t.cashierName)}</span>
                      </td>
                      <td className="py-4 px-4 min-w-[16rem] max-w-sm">
                        <div className="p-2.5 bg-rose-50/60 border border-rose-100 rounded-xl text-[#313030] text-xs leading-relaxed font-semibold break-words">
                          &ldquo;{reason || 'Pengajuan hapus nota oleh kasir'}&rdquo;
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {t.deleteAttachmentUrl ? <AttachmentChip url={t.deleteAttachmentUrl} /> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-4 px-4 text-right font-black text-[#313030] text-sm whitespace-nowrap">
                        Rp {t.grandTotal.toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        {approved ? (
                          <>
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[10px] px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>Disetujui</span>
                            </span>
                            {approver && (
                              <span className="block text-[10px] text-slate-500 font-semibold mt-1.5">oleh {formatEmployeeName(approver)}</span>
                            )}
                            {approvedAt && (
                              <span className="block text-[10px] text-slate-400 font-semibold">{approvedAt}</span>
                            )}
                          </>
                        ) : (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-2xs animate-pulse">
                            <Clock className="h-3 w-3 text-amber-700" />
                            <span>Menunggu Approval</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="py-14 text-center text-slate-400">
                    <ShieldAlert className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-xs text-[#313030]">Tidak ada pengajuan hapus nota yang ditemukan</p>
                    <p className="text-[11px] mt-0.5">Semua pengajuan request delete akan tampil di sini</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          pagination={pagination}
          accent="bg-rose-600"
          accentSoft="bg-rose-50 text-rose-700 hover:bg-rose-100"
        />
      </div>
    </div>
  );
}
