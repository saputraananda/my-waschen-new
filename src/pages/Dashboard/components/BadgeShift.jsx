import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock, User, Wallet } from 'lucide-react';
import { formatEmployeeName } from '../../../utils/FormatName.js';
import { formatDateId } from '../../../utils/FilterDate.js';

function getMinutesNow() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Badge shift:
 * - Loading (shift belum dicek) → skeleton netral, BUKAN "Belum Open"
 * - Belum open (setelah dicek) → reminder open shift
 * - Shift aktif + lewat jam closing → kedip close shift
 */
export default function BadgeShift({
  shift,
  shiftChecked = true,
  currentEmployeeId,
  onOpenClose,
  onOpenShift
}) {
  const [minutes, setMinutes] = useState(getMinutesNow);

  useEffect(() => {
    const tick = () => setMinutes(getMinutesNow());
    tick();

    const intervalId = setInterval(tick, 30_000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, []);

  const afterOpenReminder = minutes >= 8 * 60;
  const isOpen = shift && shift.status === 'Open';

  // Masih loading / optimistic belum dikonfirmasi API — jangan tampilkan "Belum Open"
  if (!shiftChecked && !isOpen) {
    return (
      <div className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 border border-[#e0e0e0] rounded-2xl shadow-xs">
        <div className="h-5 w-5 rounded-full bg-slate-200 animate-pulse shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3 w-40 max-w-full bg-slate-200 rounded animate-pulse" />
          <div className="h-2.5 w-56 max-w-full bg-slate-100 rounded animate-pulse" />
        </div>
        <span className="text-[10px] font-bold text-slate-400 shrink-0">Cek shift…</span>
      </div>
    );
  }

  // Belum open shift — hanya setelah API selesai dicek
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpenShift}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-left cursor-pointer transition-colors shadow-xs ${
          afterOpenReminder
            ? 'bg-sky-50 border border-sky-300 hover:bg-sky-100 animate-pulse'
            : 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Wallet className={`h-5 w-5 shrink-0 ${afterOpenReminder ? 'text-sky-700' : 'text-amber-700'}`} />
          <div className="min-w-0">
            <span className={`text-xs font-black block truncate ${afterOpenReminder ? 'text-sky-900' : 'text-amber-900'}`}>
              {afterOpenReminder
                ? 'Belum Open Shift — sudah lewat jam 08.00'
                : 'Belum Open Shift'}
            </span>
            <span className={`text-[10px] font-medium flex items-center gap-1 mt-0.5 ${afterOpenReminder ? 'text-sky-700' : 'text-amber-700'}`}>
              <Clock className="h-3 w-3" />
              Klik Order Baru atau badge ini untuk membuka sesi kas
            </span>
          </div>
        </div>
        <span className={`px-3 py-1.5 text-white text-[10px] font-black rounded-xl shrink-0 ${
          afterOpenReminder ? 'bg-sky-600' : 'bg-amber-600'
        }`}>
          Open Shift
        </span>
      </button>
    );
  }

  const sn = Number(shift.shift_number) || 1;
  const threshold = sn === 1 ? 17 * 60 : 20 * 60;
  const isPastClosing = minutes >= threshold;
  const isBackup = currentEmployeeId
    && Number(shift.cashier_employee_id) !== Number(currentEmployeeId);

  const openerLabel = formatEmployeeName(shift.opener_name);
  const lastActiveLabel = formatEmployeeName(shift.last_active_name);

  const closingLabel = sn === 1
    ? 'Shift Pagi belum Closing (lewat jam 17.00) — pilih Handover atau Finalisasi'
    : 'Shift Siang belum Closing Final (lewat jam 20.00)';

  return (
    <div className="space-y-2">
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-white border border-[#e0e0e0] rounded-2xl shadow-xs">
        <div className="flex items-start gap-2.5 min-w-0">
          <User className="h-4 w-4 text-[#5f1340] shrink-0 mt-0.5" />
          <div className="min-w-0 text-xs">
            <span className="font-black text-[#313030] block">
              Shift {sn === 1 ? 'Pagi' : 'Siang'} · dibuka oleh {openerLabel}
            </span>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
              {shift.opened_at
                ? `Sejak ${formatDateId(shift.opened_at, { dateStyle: 'medium', timeStyle: 'short' })}`
                : 'Sesi kas outlet aktif'}
              {shift.last_active_name && shift.last_active_name !== shift.opener_name && (
                <> · terakhir aktif: {lastActiveLabel}</>
              )}
            </span>
            {isBackup && (
              <span className="text-[10px] text-amber-700 font-bold block mt-1">
                Anda melanjutkan shift ini sebagai kasir pengganti — saat closing, Anda yang menutup shift.
              </span>
            )}
          </div>
        </div>
        {onOpenClose && (
          <button
            type="button"
            onClick={onOpenClose}
            className="px-3 py-1.5 bg-[#5f1340]/10 text-[#5f1340] text-[10px] font-black rounded-xl shrink-0 hover:bg-[#5f1340]/15 cursor-pointer"
          >
            Closing Shift
          </button>
        )}
      </div>

      {isPastClosing && (
        <button
          type="button"
          onClick={onOpenClose}
          className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-3 bg-amber-50 border border-amber-300 rounded-2xl text-left cursor-pointer hover:bg-amber-100 transition-colors shadow-xs animate-pulse"
        >
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-black text-amber-900 block leading-snug">{closingLabel}</span>
              <span className="text-[10px] text-amber-700 font-medium flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3 shrink-0" />
                <span>
                  {isBackup
                    ? 'Kasir pembuka sudah logout — tutup shift sebagai pengganti'
                    : 'Klik untuk membuka modal Closing Shift'}
                </span>
              </span>
            </div>
          </div>
          <span className="px-3.5 py-1.5 bg-amber-600 text-white text-[10px] sm:text-xs font-black rounded-xl shrink-0 self-end sm:self-auto text-center shadow-xs">
            Closing Sekarang
          </span>
        </button>
      )}
    </div>
  );
}
