import React, { useState } from 'react';
import { formatRupiah } from '../../utils/FormatRupiah.js';
import { formatEmployeeName } from '../../utils/FormatName.js';
import { Clock, User, Wallet, ArrowRight, AlertCircle } from 'lucide-react';

export default function ResumeShiftModal({
  shift,
  currentEmployeeId,
  onConfirm,
  onCancel
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const sn = Number(shift?.shift_number) || 1;
  const shiftLabel = sn === 2 ? 'Shift Siang (10.30 - 20.00)' : 'Shift Pagi (08.00 - 17.00)';
  const openedAt = shift?.opened_at ? new Date(shift.opened_at) : null;
  const isSameOpener = Number(shift?.cashier_employee_id) === Number(currentEmployeeId);
  const lastActiveName = formatEmployeeName(shift?.last_active_name);
  const openerName = formatEmployeeName(shift?.opener_name);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Gagal melanjutkan shift');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#313030]/70 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[#e0e0e0] bg-[#5f1340]/5 flex items-center gap-3">
          <div className="p-2.5 bg-[#5f1340]/10 text-[#5f1340] rounded-xl">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#313030]">Lanjutkan Shift Aktif</h3>
            <p className="text-[10px] text-slate-400">{shiftLabel} · sesi kas outlet masih terbuka</p>
          </div>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-4 bg-slate-50 border border-[#e0e0e0] rounded-2xl space-y-3">
            <div className="flex items-start gap-2.5">
              <User className="h-4 w-4 text-[#5f1340] shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Dibuka oleh
                </span>
                <span className="text-sm font-black text-[#313030] block">{openerName}</span>
                {openedAt && (
                  <span className="text-[10px] text-slate-500 font-medium">
                    {openedAt.toLocaleDateString('id-ID')} · {openedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            {lastActiveName && shift?.last_active_name && shift.last_active_name !== shift.opener_name && (
              <div className="pt-2 border-t border-[#e0e0e0]/70">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Terakhir aktif
                </span>
                <span className="text-xs font-bold text-slate-700">{lastActiveName}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white border border-[#e0e0e0] rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 block mb-1">Cash Modal Awal</span>
              <span className="text-sm font-black text-[#5f1340]">
                {formatRupiah(String(Math.round(parseFloat(shift?.initial_cash) || 0)))}
              </span>
            </div>
            <div className="p-3 bg-white border border-[#e0e0e0] rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 block mb-1">Petty Cash Awal</span>
              <span className="text-sm font-black text-[#5f1340]">
                {formatRupiah(String(Math.round(parseFloat(shift?.initial_petty_cash) || 0)))}
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-medium leading-relaxed">
            {isSameOpener ? (
              <>
                <Wallet className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                Shift Anda masih aktif di outlet ini. Logout tadi <strong>tidak menutup kas</strong> — lanjutkan transaksi seperti biasa.
              </>
            ) : (
              <>
                <Wallet className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                Anda melanjutkan sesi kas yang sama (backup / ganti shift). Transaksi pakai PIN masing-masing. Saat jam closing, <strong>Anda juga bisa menutup shift</strong> ini jika kasir pembuka tidak ada.
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 py-3.5 bg-gradient-to-r from-[#5f1340] to-[#7d1956] text-white font-black rounded-2xl text-xs shadow-md disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? 'Menyambungkan...' : 'Lanjutkan Shift'}
              {!submitting && <ArrowRight className="h-4 w-4" />}
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
        </div>
      </div>
    </div>
  );
}
