import React, { useMemo } from 'react';
import { CalendarRange, RotateCcw } from 'lucide-react';
import { getCutoffMonthKey, getCutoffRangeForMonth } from '../utils/dateCutoffFilter.js';

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/** 5 tahun terakhir (terbaru dulu) sebagai opsi periode cutoff. */
const buildYearOptions = (currentYear) => (
  Array.from({ length: 5 }, (_, i) => currentYear - i)
);

/**
 * Filter tanggal 2 mode (inline compact):
 * - cutoff: otomatis 26 → 25
 * - range: dari–sampai manual
 */
export default function DateModeFilter({
  mode = 'cutoff',
  onModeChange,
  rangeStart = '',
  rangeEnd = '',
  onRangeStartChange,
  onRangeEndChange,
  cutoffMonth = '',
  onCutoffMonthChange,
  onReset,
  showCutoffLabel = true,
  className = ''
}) {
  const defaultMonth = useMemo(() => getCutoffMonthKey(), []);
  const activeMonth = cutoffMonth || defaultMonth;
  const [activeYear, activeMonthNo] = activeMonth.split('-').map(Number);
  const yearOptions = useMemo(
    () => buildYearOptions(Number(defaultMonth.split('-')[0])),
    [defaultMonth]
  );
  const cutoff = useMemo(() => getCutoffRangeForMonth(activeMonth), [activeMonth]);

  const emitMonth = (year, monthNo) => {
    onCutoffMonthChange?.(`${year}-${String(monthNo).padStart(2, '0')}`);
  };

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      <div className="inline-flex rounded-xl border border-[#e0e0e0] bg-white overflow-hidden shadow-2xs shrink-0">
        <button
          type="button"
          onClick={() => onModeChange?.('cutoff')}
          className={`px-2.5 py-1.5 text-[10px] font-black transition-colors cursor-pointer ${
            mode === 'cutoff'
              ? 'bg-[#5f1340] text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
          title={cutoff.label}
        >
          Cutoff
        </button>
        <button
          type="button"
          onClick={() => onModeChange?.('range')}
          className={`px-2.5 py-1.5 text-[10px] font-black transition-colors cursor-pointer border-l border-[#e0e0e0] ${
            mode === 'range'
              ? 'bg-[#5f1340] text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Range
        </button>
      </div>

      {mode === 'cutoff' ? (
        <>
          <select
            value={activeMonthNo}
            onChange={(e) => emitMonth(activeYear, Number(e.target.value))}
            className="shrink-0 px-2 py-1.5 border border-[#e0e0e0] rounded-xl bg-white text-[11px] font-bold text-[#313030] outline-none focus:border-[#5f1340] cursor-pointer"
            title="Pilih bulan cutoff"
          >
            {MONTHS_ID.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>

          <select
            value={activeYear}
            onChange={(e) => emitMonth(Number(e.target.value), activeMonthNo)}
            className="shrink-0 px-2 py-1.5 border border-[#e0e0e0] rounded-xl bg-white text-[11px] font-bold text-[#313030] outline-none focus:border-[#5f1340] cursor-pointer"
            title="Pilih tahun cutoff"
          >
            {!yearOptions.includes(activeYear) && (
              <option value={activeYear}>{activeYear}</option>
            )}
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {showCutoffLabel ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl border border-[#5f1340]/15 bg-[#5f1340]/5 text-[10px] font-bold text-[#5f1340] whitespace-nowrap"
              title={`Periode cutoff: ${cutoff.label}`}
            >
              <CalendarRange className="h-3 w-3 shrink-0" />
              {cutoff.label}
            </span>
          ) : null}
        </>
      ) : (
        <>
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => onRangeStartChange?.(e.target.value)}
            className="w-[8.5rem] px-2 py-1.5 border border-[#e0e0e0] rounded-xl text-[11px] font-bold text-[#313030] bg-white outline-none focus:border-[#5f1340] cursor-pointer"
            title="Tanggal mulai"
          />
          <span className="text-[10px] font-bold text-slate-400">s/d</span>
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => onRangeEndChange?.(e.target.value)}
            className="w-[8.5rem] px-2 py-1.5 border border-[#e0e0e0] rounded-xl text-[11px] font-bold text-[#313030] bg-white outline-none focus:border-[#5f1340] cursor-pointer"
            title="Tanggal akhir"
          />
          {(rangeStart || rangeEnd) ? (
            <button
              type="button"
              onClick={() => {
                onRangeStartChange?.('');
                onRangeEndChange?.('');
                onReset?.();
              }}
              className="inline-flex items-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
              title="Reset rentang tanggal"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
