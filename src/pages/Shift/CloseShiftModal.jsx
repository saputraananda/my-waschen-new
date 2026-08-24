import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { formatRupiah, parseRupiah } from '../../utils/FormatRupiah.js';
import { formatEmployeeName } from '../../utils/FormatName.js';
import { Check, X, ClipboardCheck, Users, User, AlertTriangle } from 'lucide-react';
import PinVerifyModal from './PinVerifyModal.jsx';

export default function CloseShiftModal({
  shift,
  employeeId,
  onClose,
  onClosed
}) {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [actualPetty, setActualPetty] = useState('');
  const [revenue, setRevenue] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [verifiedCloserId, setVerifiedCloserId] = useState(null);
  // Shift 1: pilih Handover (default) atau Finalisasi. Shift 2: selalu Finalisasi.
  const [closeType, setCloseType] = useState(
    Number(shift?.shift_number) === 1 ? 'Handover' : 'Final'
  );

  const shiftId = shift?.id;
  const isShiftPagi = Number(shift?.shift_number) === 1;
  const isFinalClose = closeType === 'Final';
  const isBackupCloser = Number(shift?.cashier_employee_id) !== Number(employeeId);
  const openerLabel = formatEmployeeName(shift?.opener_name, 'Kasir');
  const [cashierFilter, setCashierFilter] = useState('Semua');

  const frontliners = useMemo(() => {
    const seen = new Map();
    txns.forEach((t) => {
      const id = t.cashier_employee_id;
      if (id && !seen.has(id)) {
        seen.set(id, {
          id,
          name: t.cashier_name || `Karyawan #${id}`
        });
      }
    });
    return Array.from(seen.values());
  }, [txns]);

  const filteredTxns = useMemo(() => {
    if (cashierFilter === 'Semua') return txns;
    const match = cashierFilter.match(/^frontliner-(\d+)$/);
    if (!match) return txns;
    const fl = frontliners[parseInt(match[1], 10)];
    if (!fl) return txns;
    return txns.filter((t) => Number(t.cashier_employee_id) === Number(fl.id));
  }, [txns, cashierFilter, frontliners]);

  const renderPaymentCell = (t) => {
    const status = t.payment_status;
    if (status === 'Lunas') {
      return <span className="text-[#313030]">{t.payment_method || 'Lunas'}</span>;
    }
    if (status === 'DP') {
      return (
        <span className="text-amber-700 font-black">
          DP{t.payment_method && t.payment_method !== '-' ? ` (${t.payment_method})` : ''}
        </span>
      );
    }
    return <span className="text-rose-600 font-black">Belum</span>;
  };

  const loadTxns = async () => {
    if (!shiftId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/shifts/${shiftId}/transactions`);
      if (res.data?.success) {
        setTxns(res.data.data || []);
        const paidTotal = (res.data.data || [])
          .filter((t) => t.payment_status === 'Lunas')
          .reduce((s, t) => s + (parseFloat(t.grand_total) || 0), 0);
        setRevenue(formatRupiah(String(Math.round(paidTotal))));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTxns();
    if (shift) {
      setActualCash(formatRupiah(String(Math.round(parseFloat(shift.initial_cash) || 0))));
      setActualPetty(formatRupiah(String(Math.round(parseFloat(shift.initial_petty_cash) || 0))));
      setCloseType(Number(shift.shift_number) === 1 ? 'Handover' : 'Final');
    }
  }, [shiftId]);

  const allVerified = txns.length === 0 || txns.every((t) => Number(t.is_verified) === 1);

  const toggleVerify = async (txn) => {
    const next = !(Number(txn.is_verified) === 1);
    try {
      await axios.post(`/api/shifts/${shiftId}/verify-txn`, {
        transactionId: txn.id,
        verifiedBy: parseInt(employeeId),
        verified: next
      });
      setTxns((prev) =>
        prev.map((t) => (t.id === txn.id ? { ...t, is_verified: next ? 1 : 0 } : t))
      );
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const submitClose = async (closingEmployeeId) => {
    const resolvedCloserId = closingEmployeeId || verifiedCloserId || parseInt(employeeId, 10);
    setSubmitting(true);
    setError('');
    try {
      const res = await axios.post(`/api/shifts/${shiftId}/close`, {
        actualCash: parseRupiah(actualCash),
        actualPettyCash: parseRupiah(actualPetty),
        declaredRevenue: parseRupiah(revenue),
        closeType,
        cashierEmployeeId: resolvedCloserId
      });
      if (res.data?.success) {
        const text = res.data.reportText || res.data.data?.report_text || '';
        try {
          if (text) await navigator.clipboard.writeText(text);
        } catch (_) { /* clipboard optional */ }
        if (onClosed) onClosed(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (e) => {
    e.preventDefault();
    if (!allVerified) {
      setError('Centang semua nota terlebih dahulu');
      return;
    }
    if (isBackupCloser && !verifiedCloserId) {
      setShowPinModal(true);
      return;
    }
    await submitClose();
  };

  if (showPinModal) {
    return (
      <PinVerifyModal
        outletId={shift?.outlet_id}
        defaultEmployeeId={employeeId}
        title="PIN Closing Shift"
        description={`Shift dibuka oleh ${openerLabel}. Masukkan PIN Anda untuk menutup shift sebagai kasir pengganti.`}
        submitLabel="Verifikasi & Lanjut Closing"
        onCancel={() => setShowPinModal(false)}
        onVerified={({ employeeId: pinEmployeeId }) => {
          setVerifiedCloserId(pinEmployeeId);
          setShowPinModal(false);
          submitClose(pinEmployeeId);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-[#313030]/70 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-[#e0e0e0] bg-[#f8f8f8] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#5f1340]/10 text-[#5f1340] rounded-xl">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#313030]">
                Closing Shift {isShiftPagi ? 'Pagi' : 'Siang'}
              </h3>
              <p className="text-[10px] text-slate-400">Ceklis semua nota, pilih tipe closing, lalu isi cash / petty / revenue</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-[#313030]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleClose} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">{error}</div>
            )}

            <div className="p-3 bg-slate-50 border border-[#e0e0e0] rounded-xl text-[11px] space-y-1">
              <span className="font-black text-[#313030] block">
                Riwayat shift: dibuka oleh {openerLabel}
                {shift?.opened_at && (
                  <> · {new Date(shift.opened_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</>
                )}
              </span>
              {isBackupCloser && (
                <span className="text-amber-800 font-bold flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Anda menutup shift sebagai kasir pengganti — PIN wajib saat submit.
                </span>
              )}
            </div>

            {isShiftPagi && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Tipe Closing *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCloseType('Handover')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${closeType === 'Handover'
                      ? 'border-[#5f1340] bg-[#5f1340]/5'
                      : 'border-[#e0e0e0] bg-white hover:border-[#5f1340]/30'
                      }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-black text-[#313030]">
                      <Users className={`h-4 w-4 ${closeType === 'Handover' ? 'text-[#5f1340]' : 'text-slate-400'}`} />
                      Handover
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1 leading-snug">
                      Serah terima ke shift siang. Frontliner berikutnya akan open shift 2.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCloseType('Final')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${closeType === 'Final'
                      ? 'border-[#5f1340] bg-[#5f1340]/5'
                      : 'border-[#e0e0e0] bg-white hover:border-[#5f1340]/30'
                      }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-black text-[#313030]">
                      <User className={`h-4 w-4 ${closeType === 'Final' ? 'text-[#5f1340]' : 'text-slate-400'}`} />
                      Final (1 Frontliner)
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1 leading-snug">
                      Kerja sendirian seharian / hanya 1 frontliner. Tutup final hari ini.
                    </span>
                  </button>
                </div>
              </div>
            )}

            {!isShiftPagi && (
              <div className="px-3 py-2.5 bg-slate-50 border border-[#e0e0e0] rounded-xl text-[11px] font-bold text-slate-600">
                Closing Final Shift Siang — menutup hari operasional outlet.
              </div>
            )}

            {frontliners.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Filter Pembuat Nota</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCashierFilter('Semua')}
                    className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                      cashierFilter === 'Semua'
                        ? 'bg-[#5f1340] text-white shadow-xs'
                        : 'bg-white border border-[#e0e0e0] text-slate-600 hover:border-[#5f1340]/40'
                    }`}
                  >
                    Semua
                  </button>
                  {frontliners.map((fl, idx) => {
                    const key = `frontliner-${idx}`;
                    const active = cashierFilter === key;
                    const count = txns.filter((t) => Number(t.cashier_employee_id) === Number(fl.id)).length;
                    return (
                      <button
                        key={fl.id}
                        type="button"
                        onClick={() => setCashierFilter(key)}
                        title={formatEmployeeName(fl.name, 'Frontliner')}
                        className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                          active
                            ? 'bg-[#5f1340] text-white shadow-xs'
                            : 'bg-white border border-[#e0e0e0] text-slate-600 hover:border-[#5f1340]/40'
                        }`}
                      >
                        Frontliner {idx + 1}
                        <span className={`ml-1.5 text-[9px] ${active ? 'text-white/80' : 'text-slate-400'}`}>
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>
                {cashierFilter !== 'Semua' && frontliners[parseInt(cashierFilter.replace('frontliner-', ''), 10)] && (
                  <p className="text-[10px] text-slate-500 font-medium">
                    Menampilkan nota oleh{' '}
                    <b className="text-[#313030]">
                      {formatEmployeeName(frontliners[parseInt(cashierFilter.replace('frontliner-', ''), 10)].name)}
                    </b>
                  </p>
                )}
              </div>
            )}

            <div className="overflow-x-auto border border-[#e0e0e0] rounded-2xl">
              <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-[#f8f8f8] text-slate-400 font-extrabold uppercase text-[10px] border-b border-[#e0e0e0]">
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Jam</th>
                    <th className="py-2.5 px-3">No Nota</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Bayar</th>
                    <th className="py-2.5 px-3 text-right">Nominal</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e0e0]/70 font-semibold">
                  {loading ? (
                    <tr><td colSpan={7} className="py-8 text-center text-slate-400">Memuat transaksi...</td></tr>
                  ) : txns.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-slate-400">Tidak ada transaksi di shift ini</td></tr>
                  ) : filteredTxns.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-slate-400">Tidak ada transaksi untuk filter ini</td></tr>
                  ) : (
                    filteredTxns.map((t) => {
                      const d = new Date(t.order_date);
                      const verified = Number(t.is_verified) === 1;
                      return (
                        <tr key={t.id} className={verified ? 'bg-emerald-50/40' : ''}>
                          <td className="py-2.5 px-3">{d.toLocaleDateString('id-ID')}</td>
                          <td className="py-2.5 px-3">{d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-2.5 px-3 font-mono font-black text-[#5f1340]">{t.order_no}</td>
                          <td className="py-2.5 px-3">{t.customer_name || '-'}</td>
                          <td className="py-2.5 px-3">{renderPaymentCell(t)}</td>
                          <td className="py-2.5 px-3 text-right font-black">
                            Rp {(parseFloat(t.grand_total) || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleVerify(t)}
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border transition-all cursor-pointer ${verified
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-white border-[#e0e0e0] text-slate-400 hover:border-emerald-400'
                                }`}
                              title={verified ? 'Batalkan ceklis' : 'Setujui baris ini'}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cash Modal (aktual) *</label>
                <input
                  required
                  type="text"
                  value={actualCash}
                  onChange={(e) => setActualCash(formatRupiah(e.target.value))}
                  className="w-full px-3 py-2.5 border border-[#e0e0e0] rounded-xl font-black text-sm outline-none focus:border-[#5f1340]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Petty Cash (aktual) *</label>
                <input
                  required
                  type="text"
                  value={actualPetty}
                  onChange={(e) => setActualPetty(formatRupiah(e.target.value))}
                  className="w-full px-3 py-2.5 border border-[#e0e0e0] rounded-xl font-black text-sm outline-none focus:border-[#5f1340]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Revenue {isFinalClose ? (isShiftPagi ? 'Finalisasi' : '2 (Finalisasi)') : '1 (Handover)'} *
                </label>
                <input
                  required
                  type="text"
                  value={revenue}
                  onChange={(e) => setRevenue(formatRupiah(e.target.value))}
                  className="w-full px-3 py-2.5 border border-[#e0e0e0] rounded-xl font-black text-sm outline-none focus:border-[#5f1340]"
                />
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-[#e0e0e0] bg-slate-50 flex justify-between items-center gap-3 shrink-0">
            <span className="text-[10px] font-bold text-slate-500">
              {txns.filter((t) => Number(t.is_verified) === 1).length}/{txns.length} nota disetujui
            </span>
            <button
              type="submit"
              disabled={submitting || !allVerified}
              className="px-6 py-3 bg-[#5f1340] hover:bg-[#4d0f33] text-white font-black rounded-2xl text-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting
                ? 'Menyimpan...'
                : isFinalClose
                  ? 'Close Final'
                  : 'Close Handover'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
