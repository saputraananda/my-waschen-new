import React, { useState } from 'react';
import { formatName, formatEmployeeName } from '../../../utils/FormatName';
import {
  RefreshCcw,
  Search,
  Clock,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';

export default function RequestRefundTransaction({ transactions }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('Semua'); // Semua | Pending | Approved

  const refundRequests = transactions.filter((t) => t.isRefundRequested);

  const filteredRequests = refundRequests.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      String(t.id).toLowerCase().includes(q) ||
      String(t.customerName || '').toLowerCase().includes(q) ||
      String(t.customerPhone || '').includes(q) ||
      (t.refundReason && t.refundReason.toLowerCase().includes(q));

    const matchesApproval =
      approvalFilter === 'Semua' ||
      (approvalFilter === 'Pending' &&
        (t.refundApprovalStatus === 0 ||
          t.refundApprovalStatus === '0' ||
          t.refundApprovalStatus === null)) ||
      (approvalFilter === 'Approved' &&
        (t.refundApprovalStatus === 1 || t.refundApprovalStatus === '1'));

    return matchesSearch && matchesApproval;
  });

  const pendingCount = refundRequests.filter(
    (t) => t.refundApprovalStatus === 0 || t.refundApprovalStatus === null
  ).length;
  const approvedCount = refundRequests.filter(
    (t) => t.refundApprovalStatus === 1 || t.refundApprovalStatus === '1'
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="p-3 bg-sky-50 text-sky-700 rounded-xl">
            <RefreshCcw className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Request Refund
            </span>
            <span className="text-xl font-black text-[#313030] block mt-0.5">
              {refundRequests.length} Pengajuan
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Kelebihan bayar / hapus nota
            </span>
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-2xs flex items-center gap-4 bg-gradient-to-r from-amber-50/40 via-white to-amber-50/20">
          <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
              Pending Approval
            </span>
            <span className="text-xl font-black text-amber-900 block mt-0.5">
              {pendingCount} Nota
            </span>
            <span className="text-[10px] text-amber-700 font-bold">
              Menunggu Konfirmasi App Utama
            </span>
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-2xs flex items-center gap-4 bg-gradient-to-r from-emerald-50/40 via-white to-emerald-50/20">
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Approved / Disetujui
            </span>
            <span className="text-xl font-black text-emerald-900 block mt-0.5">
              {approvedCount} Nota
            </span>
            <span className="text-[10px] text-emerald-700 font-bold">
              Diproses oleh Admin (Saldo / Tunai)
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#e0e0e0]/70 pb-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari No. Nota, Pelanggan, Alasan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-1.5 border border-[#e0e0e0] rounded-xl text-xs font-semibold text-[#313030] outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-[#e0e0e0]">
            {[
              { id: 'Semua', label: `Semua (${refundRequests.length})` },
              { id: 'Pending', label: `Pending (${pendingCount})` },
              { id: 'Approved', label: `Approved (${approvedCount})` }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setApprovalFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  approvalFilter === tab.id
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
                <th className="py-3.5 px-4">Cabang Outlet</th>
                <th className="py-3.5 px-4">Alasan / Keterangan</th>
                <th className="py-3.5 px-4 text-right">Wajib Bayar</th>
                <th className="py-3.5 px-4 text-right">Aktual Bayar</th>
                <th className="py-3.5 px-4 text-right">Gap Refund</th>
                <th className="py-3.5 px-4 text-center">Status Approval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e0e0]/70 font-semibold">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((t) => {
                  const isApproved =
                    t.refundApprovalStatus === 1 || t.refundApprovalStatus === '1';
                  const gap =
                    parseFloat(t.refundAmount) ||
                    Math.max(0, (parseFloat(t.paidAmount) || 0) - (parseFloat(t.grandTotal) || 0));

                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-sky-700 block text-xs">
                          {t.id}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Req: {t.refundRequestedAt || t.createdAt}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-[#313030] text-xs block">
                          {formatName(t.customerName)}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {t.customerPhone}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-600 font-bold block">{t.branch}</span>
                        <span className="text-[10px] text-slate-400">
                          {formatEmployeeName(t.cashierName)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="p-2.5 bg-sky-50/60 border border-sky-100 rounded-xl text-[#313030] text-xs leading-relaxed">
                          &quot;{t.refundReason || 'Pengajuan Refund Kelebihan Bayar'}&quot;
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-[#313030] text-sm whitespace-nowrap">
                        Rp {(parseFloat(t.grandTotal) || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-[#313030] text-sm whitespace-nowrap">
                        Rp {(parseFloat(t.paidAmount) || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-sky-700 text-sm whitespace-nowrap">
                        Rp {gap.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isApproved ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[10px] px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-2xs">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Approved</span>
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] px-3 py-1 rounded-full inline-flex items-center gap-1 shadow-2xs animate-pulse">
                            <Clock className="h-3 w-3 text-amber-700" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <ShieldAlert className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-xs text-[#313030]">
                      Tidak ada pengajuan refund yang ditemukan
                    </p>
                    <p className="text-[11px] mt-0.5">
                      Pilih opsi Refund pada Kelebihan Bayar saat pembayaran / pelunasan
                    </p>
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
