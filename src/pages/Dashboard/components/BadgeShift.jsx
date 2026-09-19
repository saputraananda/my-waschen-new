import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock, User, Wallet } from 'lucide-react';
import { formatEmployeeName } from '../../../utils/FormatName.js';
import { formatDateId } from '../../../utils/FilterDate.js';
import axios from 'axios';

function getMinutesNow() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function timeToMin(t) {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatDot(t) {
  if (!t) return '--.--';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t);
  return `${m[1].padStart(2, '0')}.${m[2]}`;
}

const FALLBACK_SHIFTS = [
  { shift_number: 1, name: 'Shift Pagi', open_time: '08:00:00', close_time: '17:00:00', remind_open: 1, remind_close: 1 },
  { shift_number: 2, name: 'Shift Siang', open_time: '10:30:00', close_time: '20:00:00', remind_open: 1, remind_close: 1 }
];

/**
 * Badge shift — jam open/close dari mst_time_shift (Alsa Master Absen dan Shift).
 */
export default function BadgeShift({
  shift,
  shiftChecked = true,
  currentEmployeeId,
  onOpenClose,
  onOpenShift
}) {
  const [minutes, setMinutes] = useState(getMinutesNow);
  const [shiftsCfg, setShiftsCfg] = useState(FALLBACK_SHIFTS);

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

  useEffect(() => {
    let cancelled = false;
    axios.get('/api/masters/time-config', { timeout: 10000 })
      .then((res) => {
        const list = res.data?.data?.shifts;
        if (!cancelled && Array.isArray(list) && list.length) setShiftsCfg(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const shift1 = shiftsCfg.find((s) => Number(s.shift_number) === 1) || FALLBACK_SHIFTS[0];
  const openRemindMin = timeToMin(shift1.open_time) ?? 8 * 60;
  const afterOpenReminder = Number(shift1.remind_open) !== 0 && minutes >= openRemindMin;
  const isOpen = shift && shift.status === 'Open';

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
                ? `Belum Open Shift — sudah lewat jam ${formatDot(shift1.open_time)}`
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
  const cfg = shiftsCfg.find((s) => Number(s.shift_number) === sn) || (sn === 2 ? FALLBACK_SHIFTS[1] : FALLBACK_SHIFTS[0]);
  const closeMin = timeToMin(cfg.close_time) ?? (sn === 1 ? 17 * 60 : 20 * 60);
  const isPastClosing = Number(cfg.remind_close) !== 0 && minutes >= closeMin;
  const isBackup = currentEmployeeId
    && Number(shift.cashier_employee_id) !== Number(currentEmployeeId);

  const openerLabel = formatEmployeeName(shift.opener_name);
  const lastActiveLabel = formatEmployeeName(shift.last_active_name);
  const shiftName = cfg.name || (sn === 1 ? 'Shift Pagi' : 'Shift Siang');

  const closingLabel = sn === 1
    ? `${shiftName} belum Closing (lewat jam ${formatDot(cfg.close_time)}) — pilih Handover atau Finalisasi`
    : `${shiftName} belum Closing Final (lewat jam ${formatDot(cfg.close_time)})`;

  return (
    <div className="space-y-2">
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-white border border-[#e0e0e0] rounded-2xl shadow-xs">
        <div className="flex items-start gap-2.5 min-w-0">
          <User className="h-4 w-4 text-[#5f1340] shrink-0 mt-0.5" />
          <div className="min-w-0 text-xs">
            <span className="font-black text-[#313030] block">
              {shiftName} · dibuka oleh {openerLabel}
            </span>
            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
              {shift.opened_at
                ? `Sejak ${formatDateId(shift.opened_at)}`
                : 'Shift aktif'}
              {lastActiveLabel ? ` · terakhir aktif: ${lastActiveLabel}` : ''}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenClose}
          className="shrink-0 px-3 py-1.5 rounded-xl bg-[#5f1340] text-white text-[10px] font-black hover:bg-[#4a0f32]"
        >
          {isBackup ? 'Close (Backup)' : 'Close Shift'}
        </button>
      </div>

      {isPastClosing && (
        <button
          type="button"
          onClick={onOpenClose}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-left animate-pulse"
        >
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span className="text-[11px] font-bold text-rose-800">{closingLabel}</span>
        </button>
      )}
    </div>
  );
}
