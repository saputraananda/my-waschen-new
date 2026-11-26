import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCutoffMonthKey } from '../../../utils/dateCutoffFilter.js';
import {
  computeCarryDailyTarget,
  filterOrdersByDateMode,
  listDateKeysInclusive,
  resolveAsOfDateKey,
  resolveStatDateRange,
  summarizePiutang
} from '../../../utils/dailyTargetCarry.js';
import { PiutangDetailModal, RevenueDetailModal, TodayPaymentsModal } from './StatDetailModal.jsx';

export default function StatCard({
  orders = [],
  monthlyTarget: monthlyTargetProp = 0,
  activeOutletId,
  activeOutletName,
  dateFilter,
  setActiveFilterTab
}) {
  const [periodTarget, setPeriodTarget] = useState(monthlyTargetProp || 0);
  // Modal rincian per kartu: 'revenue' | 'today' | 'piutang'.
  // Kembali dari rincian nota → state history berisi dashReopen → modal yang sama dibuka lagi.
  const location = useLocation();
  const navigate = useNavigate();
  const reopen = location.state?.dashReopen || null;
  const [detail, setDetail] = useState(reopen?.modal || null);
  useEffect(() => {
    if (reopen?.modal) setDetail(reopen.modal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
  // Tutup modal → hapus dashReopen supaya tidak terbuka lagi saat halaman dimuat ulang
  const closeDetail = () => {
    setDetail(null);
    if (location.state?.dashReopen) {
      const { dashReopen, ...rest } = location.state;
      navigate(`${location.pathname}${location.search}`, { replace: true, state: Object.keys(rest).length ? rest : null });
    }
  };
  const outletForDetail = activeOutletId || localStorage.getItem('activeOutletId') || undefined;

  const resolvedFilter = useMemo(
    () => dateFilter || { mode: 'cutoff', start: '', end: '', cutoffMonth: getCutoffMonthKey() },
    [dateFilter]
  );

  const range = useMemo(() => resolveStatDateRange(resolvedFilter), [resolvedFilter]);
  const dayKeys = useMemo(
    () => listDateKeysInclusive(range.start, range.end),
    [range.start, range.end]
  );
  const asOfKey = useMemo(() => resolveAsOfDateKey(range), [range]);

  useEffect(() => {
    let cancelled = false;
    const fetchTarget = async () => {
      try {
        const monthKey = (range.end || resolvedFilter.cutoffMonth || getCutoffMonthKey()).slice(0, 7);
        const [y, m] = monthKey.split('-').map(Number);
        const res = await axios.get('/api/masters/target', {
          params: {
            outlet_id: activeOutletId || localStorage.getItem('activeOutletId') || undefined,
            outlet: activeOutletName || localStorage.getItem('activeOutletName') || undefined,
            tahun: y,
            bulan: m
          }
        });
        if (!cancelled && res.data?.success && res.data.data?.targetNominal != null) {
          setPeriodTarget(Number(res.data.data.targetNominal) || 0);
        }
      } catch {
        if (!cancelled && monthlyTargetProp) setPeriodTarget(monthlyTargetProp);
      }
    };
    fetchTarget();
    return () => { cancelled = true; };
  }, [range.end, resolvedFilter.cutoffMonth, activeOutletId, activeOutletName, monthlyTargetProp]);

  useEffect(() => {
    if (monthlyTargetProp > 0 && !periodTarget) setPeriodTarget(monthlyTargetProp);
  }, [monthlyTargetProp, periodTarget]);

  const filteredOrders = useMemo(
    () => filterOrdersByDateMode(orders, resolvedFilter),
    [orders, resolvedFilter]
  );

  // Revenue = uang masuk dari pembayaran nota (DP/Lunas/Pelunasan) pada tanggal bayar — dari server,
  // sama dengan Daily Report & SuperApp. Nota outstanding tidak dihitung.
  const [revenue, setRevenue] = useState({ total: 0, tunai: 0, nonTunai: 0, notaCount: 0, byDay: {} });
  useEffect(() => {
    if (!range.start || !range.end) return undefined;
    let cancelled = false;
    axios.get('/api/dashboard/revenue', {
      params: {
        outlet_id: activeOutletId || localStorage.getItem('activeOutletId') || undefined,
        start: range.start,
        end: range.end
      }
    })
      .then((res) => { if (!cancelled && res.data?.success) setRevenue(res.data.data); })
      .catch(() => {});
    return () => { cancelled = true; };
    // orders ikut jadi pemicu: dashboard memuat ulang orders saat ada pembayaran baru (realtime)
  }, [range.start, range.end, activeOutletId, orders]);

  const paidCount = revenue.notaCount || 0;
  const paidRevenue = revenue.total || 0;
  const piutang = summarizePiutang(filteredOrders);
  const periodPct = periodTarget > 0 ? Math.min(999, (paidRevenue / periodTarget) * 100) : 0;

  const revenueByDay = useMemo(() => Object.fromEntries(
    Object.entries(revenue.byDay || {}).map(([day, v]) => [day, Number(v?.total) || 0])
  ), [revenue.byDay]);
  const daily = useMemo(
    () => computeCarryDailyTarget(periodTarget, dayKeys, revenueByDay, asOfKey),
    [periodTarget, dayKeys, revenueByDay, asOfKey]
  );

  const todayRev = revenue.byDay?.[asOfKey] || { tunai: 0, nonTunai: 0, notaCount: 0 };
  const todayNotaCount = todayRev.notaCount || 0;

  const todayPemasukan = daily.today.actual;
  const todayTarget = daily.today.effectiveTarget;
  const todayPct = todayTarget > 0 ? Math.min(999, (todayPemasukan / todayTarget) * 100) : 0;


  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
        Ringkasan Operasional
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
        <SummaryCard
          label="Revenue Bulan Ini"
          amount={paidRevenue}
          sub={`${paidCount.toLocaleString('id-ID')} nota dibayar`}
          note={`Tunai ${fmtRp(revenue.tunai)} · Non tunai ${fmtRp(revenue.nonTunai)}`}
          footLabel="Target"
          footValue={periodTarget > 0 ? `Rp ${periodTarget.toLocaleString('id-ID')}` : 'belum diatur'}
          aside={<ProgressRing pct={periodPct} tone="brand" />}
          onClick={() => setDetail('revenue')}
        />
        <SummaryCard
          label="Hari Ini"
          amount={todayPemasukan}
          sub={`${todayNotaCount.toLocaleString('id-ID')} nota dibayar`}
          note={`Tunai ${fmtRp(todayRev.tunai)} · Non tunai ${fmtRp(todayRev.nonTunai)}`}
          footLabel="Target"
          footValue={todayTarget > 0 ? `Rp ${todayTarget.toLocaleString('id-ID')}` : 'belum diatur'}
          title={`Target harian termasuk sisa kemarin jika ada · ${asOfKey}`}
          aside={<ProgressRing pct={todayPct} tone="amber" />}
          onClick={() => setDetail('today')}
        />
        <SummaryCard
          label="Piutang"
          amount={piutang.amount}
          sub="belum lunas"
          className="sm:col-span-2 lg:col-span-1"
          aside={(
            <div className="h-16 w-16 sm:h-[72px] sm:w-[72px] rounded-full bg-rose-50 flex flex-col items-center justify-center shrink-0">
              <span className="text-lg sm:text-xl font-black text-rose-700 tabular-nums leading-none">
                {piutang.count.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] font-bold text-rose-700/80 mt-0.5">nota</span>
            </div>
          )}
          onClick={() => setDetail('piutang')}
        />
      </div>

      <RevenueDetailModal open={detail === 'revenue'} onClose={closeDetail} outletId={outletForDetail} initial={reopen?.modal === 'revenue' ? reopen : null} />
      <TodayPaymentsModal open={detail === 'today'} onClose={closeDetail} outletId={outletForDetail} initial={reopen?.modal === 'today' ? reopen : null} />
      <PiutangDetailModal open={detail === 'piutang'} onClose={closeDetail} outletId={outletForDetail} initial={reopen?.modal === 'piutang' ? reopen : null} />
    </div>
  );
}

const RING_TONES = {
  brand: { track: '#5f1340', text: 'text-[#5f1340]' },
  amber: { track: '#b45309', text: 'text-amber-700' }
};

/** Lingkaran progres capaian target; hijau saat >= 100%. */
function ProgressRing({ pct = 0, tone = 'brand' }) {
  const t = RING_TONES[tone] || RING_TONES.brand;
  const value = Number(pct) || 0;
  const reached = value >= 100;
  const color = reached ? '#059669' : t.track;
  const r = 30;
  const c = 2 * Math.PI * r;
  const filled = Math.min(100, Math.max(0, value)) / 100 * c;
  return (
    <div className="relative h-16 w-16 sm:h-[72px] sm:w-[72px] shrink-0">
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeOpacity="0.15" strokeWidth="7" />
        {filled > 0 && (
          <circle
            cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}
            className="transition-all duration-700"
          />
        )}
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-sm sm:text-base font-black tabular-nums ${reached ? 'text-emerald-700' : t.text}`}>
        {value.toFixed(0)}%
      </span>
    </div>
  );
}

/** Kartu ringkasan: teks di kiri, indikator (ring / jumlah) di kanan. */
const fmtRp = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;

function SummaryCard({ label, amount, sub, note, footLabel, footValue, footSuffix = '', aside, title, className = '', onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`text-left bg-white border border-[#e0e0e0]/80 rounded-2xl px-4 py-3.5 shadow-xs hover:shadow-md hover:border-[#5f1340]/25 transition-all cursor-pointer min-w-0 h-full flex items-center justify-between gap-3 ${className}`}
    >
      <div className="min-w-0 flex-1">
        <span className="text-xs font-semibold text-slate-600 block truncate">{label}</span>
        <p className="text-lg sm:text-xl font-black text-[#313030] tracking-tight tabular-nums leading-tight mt-1 break-words">
          Rp {Number(amount || 0).toLocaleString('id-ID')}
        </p>
        <p className="text-[11px] font-medium text-slate-500 mt-0.5">{sub}</p>
        {note && <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate" title={note}>{note}</p>}
        {footLabel && (
          <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
            {footLabel} <span className="font-black text-[#313030] tabular-nums">{footValue}</span>{footSuffix}
          </p>
        )}
      </div>
      {aside}
    </button>
  );
}
