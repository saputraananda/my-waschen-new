import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowRight, Building2, Clock, Info, X } from 'lucide-react';

/**
 * Verifikasi sebelum pindah outlet kerja di POS.
 * Responsif: di HP tampil sebagai bottom sheet, di tablet/desktop sebagai dialog di tengah.
 *
 * @param {{ from: { name: string }, to: { name: string, requiresShift: boolean, isEvent: boolean },
 *           hasOpenShift: boolean, onConfirm: () => void, onCancel: () => void }} props
 */
export default function OutletSwitchModal({ from, to, hasOpenShift = false, onConfirm, onCancel }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCancel]);

  const notes = [
    'Nota baru, QC, dan petty cash akan tercatat di outlet tujuan.',
    to.requiresShift
      ? 'Outlet tujuan wajib shift — buka shift di sana sebelum membuat nota.'
      : 'Outlet tujuan tidak memakai shift.',
    hasOpenShift ? 'Shift di outlet saat ini tidak ditutup otomatis.' : ''
  ].filter(Boolean);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[2px] sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="outlet-switch-title"
        className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto bg-white shadow-2xl rounded-t-3xl sm:rounded-3xl pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0"
      >
        {/* Pegangan bottom sheet (HP) */}
        <div className="sm:hidden flex justify-center pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-6">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-10 w-10 shrink-0 rounded-2xl bg-[#5f1340]/10 text-[#5f1340] flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 id="outlet-switch-title" className="text-base sm:text-lg font-black text-[#313030] leading-tight">Pindah Outlet?</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">Pastikan Anda memang bertugas di outlet tujuan.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Tutup"
            className="h-8 w-8 shrink-0 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dari → Ke: bertumpuk di HP, berdampingan di layar lebar */}
        <div className="px-5 sm:px-6 mt-4 flex flex-col sm:flex-row sm:items-stretch gap-2">
          <div className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dari</p>
            <p className="text-sm font-extrabold text-slate-700 break-words">{from.name}</p>
          </div>
          <div className="flex items-center justify-center text-[#5f1340]">
            <ArrowDown className="h-4 w-4 sm:hidden" />
            <ArrowRight className="h-4 w-4 hidden sm:block" />
          </div>
          <div className="flex-1 min-w-0 rounded-2xl border border-[#5f1340]/25 bg-[#5f1340]/5 px-3.5 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#5f1340]/70">Ke</p>
            <p className="text-sm font-extrabold text-[#5f1340] break-words">{to.name}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {to.isEvent && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-800">Event</span>
              )}
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black ${to.requiresShift ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-600'}`}>
                <Clock className="h-2.5 w-2.5" /> {to.requiresShift ? 'Wajib shift' : 'Tanpa shift'}
              </span>
            </div>
          </div>
        </div>

        <ul className="mx-5 sm:mx-6 mt-3 space-y-1.5 rounded-2xl bg-amber-50/70 border border-amber-100 px-3.5 py-2.5">
          {notes.map((n) => (
            <li key={n} className="flex items-start gap-2 text-[11px] sm:text-xs font-semibold text-amber-900 leading-snug">
              <Info className="h-3.5 w-3.5 shrink-0 mt-px text-amber-600" />
              <span>{n}</span>
            </li>
          ))}
        </ul>

        <div className="px-5 sm:px-6 py-4 sm:py-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl bg-[#5f1340] hover:bg-[#4a0f32] text-sm font-black text-white shadow-md shadow-[#5f1340]/20 cursor-pointer"
          >
            Ya, Pindah Outlet
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
