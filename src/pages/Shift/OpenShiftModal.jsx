import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { formatRupiah, parseRupiah } from '../../utils/FormatRupiah.js';
import { Wallet, AlertTriangle, X } from 'lucide-react';

export default function OpenShiftModal({
  outletId,
  employeeId,
  onOpened,
  onCancel
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previousCash, setPreviousCash] = useState(0);
  const [previousPettyCash, setPreviousPettyCash] = useState(0);
  const [cashInput, setCashInput] = useState('');
  const [pettyInput, setPettyInput] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [imbalanceReason, setImbalanceReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get('/api/shifts/previous-closing', {
          params: { outlet_id: outletId || 2 }
        });
        if (res.data?.success) {
          const prevCash = res.data.data.previousCash || 0;
          const prevPetty = res.data.data.previousPettyCash || 0;
          setPreviousCash(prevCash);
          setPreviousPettyCash(prevPetty);
          setCashInput(formatRupiah(String(Math.round(prevCash))));
          setPettyInput(formatRupiah(String(Math.round(prevPetty))));
        }
      } catch (err) {
        console.error(err);
        setError('Gagal memuat riwayat closing sebelumnya');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [outletId]);

  const cashNum = parseRupiah(cashInput);
  const pettyNum = parseRupiah(pettyInput);
  const isImbalanced = cashNum !== previousCash || pettyNum !== previousPettyCash;

  const doOpen = async (reason) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await axios.post('/api/shifts/open', {
        outletId: parseInt(outletId) || 2,
        cashierEmployeeId: parseInt(employeeId),
        initialCash: cashNum,
        initialPettyCash: pettyNum,
        previousCash,
        previousPettyCash,
        openImbalanceReason: reason || null
      });

      if (res.data?.success) {
        const shift = res.data.data;
        localStorage.setItem('activeShiftId', String(shift.id));
        localStorage.setItem('shiftNumber', String(shift.shift_number));
        localStorage.setItem('activeShiftOpenedAt', shift.opened_at);
        onOpened(shift);
      } else {
        setError(res.data?.message || 'Gagal membuka shift');
      }
    } catch (err) {
      if (err.response?.data?.requireReason) {
        setShowReasonModal(true);
      } else {
        setError(err.response?.data?.message || err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!employeeId) {
      setError('Employee ID tidak ditemukan. Silakan login ulang.');
      return;
    }
    if (isImbalanced) {
      setShowReasonModal(true);
      return;
    }
    doOpen(null);
  };

  const handleConfirmReason = () => {
    if (!imbalanceReason.trim()) {
      setError('Alasan ketidaksesuaian wajib diisi');
      return;
    }
    setShowReasonModal(false);
    doOpen(imbalanceReason.trim());
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-[#313030]/70 backdrop-blur-sm flex justify-center items-center p-4">
        <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-lg shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-[#e0e0e0] bg-[#f8f8f8] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#5f1340]/10 text-[#5f1340] rounded-xl">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#313030]">Buka Sesi Kas (Open Shift)</h3>
                <p className="text-[10px] text-slate-400">Wajib sebelum Order Baru — dashboard & laporan bisa dibuka tanpa shift</p>
              </div>
            </div>
            {onCancel && (
              <button type="button" onClick={onCancel} className="p-1 text-slate-400 hover:text-[#313030] cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-10 text-center text-xs text-slate-400 font-bold">Memuat riwayat closing...</div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="p-4 bg-slate-50 border border-[#e0e0e0] rounded-2xl space-y-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Riwayat Closing Sebelumnya (tidak bisa diedit)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Cash Modal Kemarin</label>
                    <input
                      disabled
                      value={formatRupiah(String(Math.round(previousCash)))}
                      className="w-full px-3 py-2 bg-slate-100 border border-[#e0e0e0] rounded-xl font-black text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Petty Cash Kemarin</label>
                    <input
                      disabled
                      value={formatRupiah(String(Math.round(previousPettyCash)))}
                      className="w-full px-3 py-2 bg-slate-100 border border-[#e0e0e0] rounded-xl font-black text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cash Modal Hari Ini *</label>
                  <input
                    required
                    type="text"
                    value={cashInput}
                    onChange={(e) => setCashInput(formatRupiah(e.target.value))}
                    className="w-full px-3 py-2.5 border border-[#e0e0e0] rounded-xl font-black text-sm text-[#5f1340] outline-none focus:border-[#5f1340]"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Petty Cash Hari Ini *</label>
                  <input
                    required
                    type="text"
                    value={pettyInput}
                    onChange={(e) => setPettyInput(formatRupiah(e.target.value))}
                    className="w-full px-3 py-2.5 border border-[#e0e0e0] rounded-xl font-black text-sm text-[#5f1340] outline-none focus:border-[#5f1340]"
                    placeholder="0"
                  />
                </div>
              </div>

              {isImbalanced && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 font-medium">
                  Nilai tidak sama dengan closing kemarin. Anda akan diminta mengisi alasan.
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3.5 bg-gradient-to-r from-[#5f1340] to-[#7d1956] text-white font-black rounded-2xl text-xs shadow-md disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Buka Shift & Lanjut Order'}
                </button>
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={submitting}
                    className="sm:w-auto px-5 py-3.5 bg-white border border-[#e0e0e0] hover:bg-slate-50 text-slate-600 font-black rounded-2xl text-xs cursor-pointer disabled:opacity-60"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      {showReasonModal && (
        <div className="fixed inset-0 z-[70] bg-[#313030]/60 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-amber-50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <h4 className="text-sm font-black text-[#313030]">Validasi Tidak Balance</h4>
              </div>
              <button type="button" onClick={() => setShowReasonModal(false)} className="p-1 text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-600 font-medium">
                Cash Modal / Petty Cash tidak sama dengan closing sebelumnya. Jelaskan alasannya:
              </p>
              <textarea
                rows={3}
                value={imbalanceReason}
                onChange={(e) => setImbalanceReason(e.target.value)}
                placeholder="Misal: Selisih karena setoran bank belum tercatat / selisih hitung fisik..."
                className="w-full p-3 border border-[#e0e0e0] rounded-xl outline-none focus:border-amber-600 font-medium"
              />
              <button
                type="button"
                onClick={handleConfirmReason}
                disabled={submitting}
                className="w-full py-3 bg-[#5f1340] text-white font-black rounded-xl cursor-pointer disabled:opacity-60"
              >
                Simpan Alasan & Buka Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
