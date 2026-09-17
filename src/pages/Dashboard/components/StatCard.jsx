import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Wallet, CalendarDays, AlertTriangle } from 'lucide-react';
import { getCutoffMonthKey, getOrderDateKey } from '../../../utils/dateCutoffFilter.js';
import {
  buildPaidRevenueByDay,
  computeCarryDailyTarget,
  countPaidNota,
  filterOrdersByDateMode,
  listDateKeysInclusive,
  resolveAsOfDateKey,
  resolveStatDateRange,
  summarizePiutang,
  sumPaidRevenue
} from '../../../utils/dailyTargetCarry.js';

export default function StatCard({
  orders = [],
  monthlyTarget: monthlyTargetProp = 0,
  activeOutletId,
  activeOutletName,
  dateFilter,
  setActiveFilterTab
}) {
  const [periodTarget, setPeriodTarget] = useState(monthlyTargetProp || 0);

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

  const paidCount = countPaidNota(filteredOrders);
  const paidRevenue = sumPaidRevenue(filteredOrders);
  const piutang = summarizePiutang(filteredOrders);
  const periodPct = periodTarget > 0 ? Math.min(999, (paidRevenue / periodTarget) * 100) : 0;

  const revenueByDay = useMemo(() => buildPaidRevenueByDay(orders), [orders]);
  const daily = useMemo(
    () => computeCarryDailyTarget(periodTarget, dayKeys, revenueByDay, asOfKey),
    [periodTarget, dayKeys, revenueByDay, asOfKey]
  );

  const todayNotaCount = useMemo(() => (
    (orders || []).filter((o) => {
      if ((o.paymentStatus || o.payment_status) !== 'Lunas') return false;
      return getOrderDateKey(o) === asOfKey;
    }).length
  ), [orders, asOfKey]);

  const todayPemasukan = daily.today.actual;
  const todayTarget = daily.today.effectiveTarget;
  const todayPct = todayTarget > 0 ? Math.min(999, (todayPemasukan / todayTarget) * 100) : 0;

  const scrollToTracking = (tab) => {
    if (setActiveFilterTab) setActiveFilterTab(tab);
    document.getElementById('tracking-service-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">
        Ringkasan Operasional
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-stretch">
        {/* 1 — Revenue periode */}
        <button
          type="button"
          onClick={() => scrollToTracking('Semua')}
          className="text-left bg-white border border-[#e0e0e0]/70 rounded-xl px-3 py-3 shadow-xs hover:border-[#5f1340]/25 transition-all cursor-pointer min-w-0 h-full flex items-center gap-2.5"
        >
          <div className="p-2 bg-[#5f1340]/5 text-[#5f1340] rounded-lg shrink-0">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-medium text-slate-400 block leading-none">Revenue</span>
            <p className="text-[13px] font-black text-[#313030] leading-snug mt-1 break-words">
              {paidCount.toLocaleString('id-ID')} Nota
              <span className="text-slate-300 font-bold mx-1">·</span>
              Rp {paidRevenue.toLocaleString('id-ID')}
            </p>
            <p className="text-[10px] font-medium text-slate-400 mt-1 break-words">
              Target Bulan Ini Rp {periodTarget.toLocaleString('id-ID')}
            </p>
          </div>
          <span className="text-xl font-black text-[#c45a5a] tabular-nums shrink-0 leading-none">
            {periodPct.toFixed(0)}%
          </span>
        </button>

        {/* 2 — Hari ini (aktual) */}
        <button
          type="button"
          onClick={() => scrollToTracking('Semua')}
          title={`Target harian termasuk sisa kemarin jika ada · ${asOfKey}`}
          className="text-left bg-white border border-[#e0e0e0]/70 rounded-xl px-3 py-3 shadow-xs hover:border-[#5f1340]/25 transition-all cursor-pointer min-w-0 h-full flex items-center gap-2.5"
        >
          <div className="p-2 bg-amber-50 text-amber-700 rounded-lg shrink-0">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-medium text-slate-400 block leading-none">Hari Ini</span>
            <p className="text-[13px] font-black text-[#313030] leading-snug mt-1 break-words">
              {todayNotaCount.toLocaleString('id-ID')} Nota
              <span className="text-slate-300 font-bold mx-1">·</span>
              Rp {todayPemasukan.toLocaleString('id-ID')}
            </p>
            <p className="text-[10px] font-medium text-slate-400 mt-1 break-words">
              Target Kamu Hari Ini Rp {todayTarget.toLocaleString('id-ID')}
            </p>
          </div>
          <span className="text-xl font-black text-amber-600 tabular-nums shrink-0 leading-none">
            {todayPct.toFixed(0)}%
          </span>
        </button>

        {/* 3 — Piutang */}
        <button
          type="button"
          onClick={() => scrollToTracking('proses_belum_bayar')}
          className="text-left bg-white border border-[#e0e0e0]/70 rounded-xl px-3 py-3 shadow-xs hover:border-rose-300 transition-all cursor-pointer min-w-0 h-full flex items-center gap-2.5"
        >
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-medium text-slate-400 block leading-none">Piutang</span>
            <p className="text-[13px] font-black text-[#313030] leading-snug mt-1 break-words">
              {piutang.count.toLocaleString('id-ID')} Nota
              <span className="text-slate-300 font-bold mx-1">·</span>
              Rp {piutang.amount.toLocaleString('id-ID')}
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
