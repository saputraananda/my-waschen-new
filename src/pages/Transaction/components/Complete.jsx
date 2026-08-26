import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  CheckCircle2,
  Printer,
  Home,
  Plus,
  Receipt,
  User,
  CreditCard,
  Clock
} from 'lucide-react';
import HeaderNav from '../../../components/HeaderNav';
import ThermalNota from '../../../components/ThermalNota.jsx';
import { formatName, formatEmployeeName } from '../../../utils/FormatName.js';
import { useShift } from '../../../context/ShiftContext.jsx';

const paymentBadge = (status) => {
  if (status === 'Lunas') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'DP') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
};

export default function Complete() {
  const navigate = useNavigate();
  const location = useLocation();
  const { startOrderFlow } = useShift();
  const receipt = location.state?.receipt;

  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || 'Waschen Laundry Citra Gran');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '2');
  const [outlets, setOutlets] = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    document.title = 'Transaksi Berhasil | Waschen Laundry';
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    if (!receipt) {
      navigate('/transaction', { replace: true });
      return;
    }
    const isHq = localStorage.getItem('companyId') === '1';
    setUserProfile({
      fullName: localStorage.getItem('fullName') || 'Kasir Waschen',
      role: isHq ? 'Management Alora' : (localStorage.getItem('activeRole') || 'Staff Kasir')
    });

    axios.get('/api/masters/outlets')
      .then((res) => {
        if (res.data?.success) setOutlets(res.data.data || []);
      })
      .catch(() => {});
  }, [receipt, navigate]);

  if (!receipt) return null;

  const ps = receipt.paymentStatus || 'Lunas';
  const cashierDisplay = formatEmployeeName(receipt.cashierFullName || receipt.cashierName, 'Frontliner');
  const isUnpaid = ps === 'Outstanding';
  const isDP = ps === 'DP';

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#313030] flex flex-col font-sans">
      <HeaderNav
        activeOutletName={activeOutletName}
        setActiveOutletName={setActiveOutletName}
        activeOutletId={activeOutletId}
        setActiveOutletId={setActiveOutletId}
        outlets={outlets}
        userProfile={userProfile}
      />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-2xl animate-fade-in">
          {/* Success hero */}
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h1 className="text-xl font-black text-[#5f1340] uppercase tracking-wide">Transaksi Berhasil!</h1>
            <p className="text-sm text-slate-600 mt-2 font-medium whitespace-nowrap overflow-x-auto px-1">
              Terima Kasih <span className="font-black text-[#5f1340]">{cashierDisplay}</span>, tetap semangat gapai target yaa!
            </p>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">
              Nota telah disimpan dan siap diproses.
            </p>
          </div>

          {/* Summary card */}
          <div className="bg-white border border-[#e0e0e0] rounded-3xl shadow-md overflow-hidden mb-5">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-[#5f1340] to-emerald-400" />
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-[#5f1340]" />
                  <span className="font-mono font-black text-lg text-[#5f1340]">{receipt.id}</span>
                </div>
                <span className={`px-3 py-1 rounded-xl border text-[10px] font-black ${
                  isUnpaid ? 'bg-rose-50 text-rose-700 border-rose-200' : paymentBadge(ps)
                }`}>
                  {isUnpaid ? 'Belum' : ps}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#f8f8f8] rounded-xl border border-[#e0e0e0]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <User className="h-3 w-3" /> Pelanggan
                  </span>
                  <p className="font-extrabold text-[#313030] mt-1">{formatName(receipt.customerName)}</p>
                  <p className="text-slate-500 font-medium">{receipt.customerPhone}</p>
                </div>
                <div className="p-3 bg-[#f8f8f8] rounded-xl border border-[#e0e0e0]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Pembayaran
                  </span>
                  <p className="font-extrabold text-[#313030] mt-1">
                    Rp {(receipt.grandTotal || 0).toLocaleString('id-ID')}
                  </p>
                  <p className={`font-medium ${isUnpaid ? 'text-rose-600 font-black' : 'text-slate-500'}`}>
                    {isUnpaid
                      ? 'Belum'
                      : isDP
                        ? `DP • Rp ${(receipt.paidAmount || 0).toLocaleString('id-ID')}`
                        : `${receipt.paymentMethod}${receipt.paidAmount ? ` • Rp ${receipt.paidAmount.toLocaleString('id-ID')}` : ''}`}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#5f1340]/5 border border-[#5f1340]/15 rounded-xl flex items-center gap-2 text-xs">
                <Clock className="h-4 w-4 text-[#5f1340] shrink-0" />
                <span className="text-slate-600 font-medium">
                  Estimasi selesai: <b className="text-[#313030]">{receipt.estimatedCompletion || '2-3 Hari Kerja'}</b>
                </span>
              </div>

              <div className="text-[10px] text-slate-400 font-medium text-center">
                {receipt.items?.length || 0} item • {receipt.branch} • {receipt.createdAt}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#5f1340] to-[#7d1956] hover:from-[#4d0f33] hover:to-[#6a1549] text-white font-black text-sm shadow-lg shadow-[#5f1340]/25 flex items-center justify-center gap-2.5 cursor-pointer transition-all active:scale-98"
            >
              <Printer className="h-5 w-5" />
              <span>Cetak Struk Nota POS</span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => startOrderFlow()}
                className="py-3 rounded-2xl bg-white border border-[#e0e0e0] hover:border-[#5f1340]/40 text-[#313030] font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Plus className="h-4 w-4 text-[#5f1340]" />
                <span>Transaksi Baru</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard', { replace: true })}
                className="py-3 rounded-2xl bg-white border border-[#e0e0e0] hover:border-[#5f1340]/40 text-[#313030] font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Home className="h-4 w-4 text-[#5f1340]" />
                <span>Beranda</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {showPrintModal && (
        <ThermalNota
          createdOrderReceipt={receipt}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
