import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CalendarDays } from 'lucide-react';

/** Tanggal hari ini (WIB) format YYYY-MM-DD */
export const todayWib = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

/** paidDate untuk dikirim ke API: kosong bila hari ini / tidak dipilih */
export const paidDatePayload = (value) => (value && value !== todayWib() ? value : undefined);

/** Ambil setelan "Bayar Backdate" dari Super App (diatur di Master Data › Metode Pembayaran). */
export function useBackdateSetting(active = true) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    axios.get('/api/masters/payment-settings')
      .then((res) => { if (!cancelled) setEnabled(Boolean(res.data?.data?.allowBackdatePayment)); })
      .catch(() => { if (!cancelled) setEnabled(false); });
    return () => { cancelled = true; };
  }, [active]);
  return enabled;
}

/** Tanggal nota (Date / ISO UTC / 'YYYY-MM-DD ...') → YYYY-MM-DD WIB */
export const toWibYmd = (val) => {
  if (!val) return undefined;
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}($|\s)/.test(s)) return s.slice(0, 10);
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
};

const fmtLong = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString('id-ID', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});

/**
 * Pilihan tanggal bayar untuk modal pelunasan. Hanya tampil bila admin mengizinkan bayar backdate.
 * value '' = hari ini. minDate = tanggal nota (tidak boleh bayar sebelum nota dibuat).
 */
export default function BackdatePaymentField({ value, onChange, minDate }) {
  const enabled = useBackdateSetting(true);
  const today = todayWib();

  // Setelan dimatikan saat modal terbuka → kembali ke hari ini
  useEffect(() => {
    if (!enabled && value) onChange('');
  }, [enabled, value, onChange]);

  if (!enabled) return null;

  const current = value || today;
  const backdated = current !== today;
  const min = toWibYmd(minDate);

  return (
    <div className={`rounded-xl border p-3 ${backdated ? 'border-amber-300 bg-amber-50' : 'border-[#e0e0e0] bg-[#fafafa]'}`}>
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
        <CalendarDays className="h-3.5 w-3.5" /> Tanggal Bayar
      </label>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={current}
          max={today}
          min={min}
          onChange={(e) => onChange(e.target.value && e.target.value !== today ? e.target.value : '')}
          className="flex-1 min-w-0 px-3 py-2 bg-white border border-[#e0e0e0] rounded-xl text-xs font-bold text-[#313030] outline-none focus:border-[#5f1340]"
        />
        {backdated && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="shrink-0 px-2.5 py-2 rounded-xl border border-[#e0e0e0] bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50"
          >
            Hari ini
          </button>
        )}
      </div>
      <p className={`text-[10px] font-medium mt-1 ${backdated ? 'text-amber-800' : 'text-slate-500'}`}>
        {backdated
          ? `Backdate: pelunasan dicatat tanggal ${fmtLong(current)}.`
          : 'Pelunasan dicatat hari ini. Ubah tanggal bila pembayaran terjadi di hari sebelumnya.'}
      </p>
    </div>
  );
}
