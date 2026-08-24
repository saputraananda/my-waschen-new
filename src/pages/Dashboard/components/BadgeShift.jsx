import React from 'react';
import { AlertCircle, Clock, User, Wallet } from 'lucide-react';
import { formatEmployeeName } from '../../../utils/FormatName.js';

/**
 * Badge shift:
 * - Belum open + sudah ≥ 08.00 → kedip "Open Shift"
 * - Shift aktif + lewat jam closing (17 / 20) → kedip "Close Shift"
 */
export default function BadgeShift({ shift, currentEmployeeId, onOpenClose, onOpenShift }) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const afterOpenReminder = minutes >= 8 * 60;

  // Belum open shift — reminder mulai jam 08.00
  if (!shift || shift.status !== 'Open') {
    if (!afterOpenReminder) return null;

    return (
      <button
        type="button"
        onClick={onOpenShift}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-sky-50 border border-sky-300 rounded-2xl text-left cursor-pointer hover:bg-sky-100 transition-colors shadow-xs animate-pulse"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Wallet className="h-5 w-5 text-sky-700 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-black text-sky-900 block truncate">
              Belum Open Shift — sudah lewat jam 08.00
            </span>
            <span className="text-[10px] text-sky-700 font-medium flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" />
              Klik Order Baru atau badge ini untuk membuka sesi kas
            </span>
          </div>
        </div>
        <span className="px-3 py-1.5 bg-sky-600 text-white text-[10px] font-black rounded-xl shrink-0">
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
                ? `Sejak ${new Date(shift.opened_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
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
