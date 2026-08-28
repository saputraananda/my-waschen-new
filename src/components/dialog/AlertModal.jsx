import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

const ICON_MAP = {
  success: { Icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600' },
  error: { Icon: AlertCircle, bg: 'bg-rose-50', text: 'text-rose-600' },
  warning: { Icon: AlertCircle, bg: 'bg-amber-50', text: 'text-amber-600' },
  info: { Icon: Info, bg: 'bg-sky-50', text: 'text-sky-600' }
};

export default function AlertModal({ open, onClose, title, desc, type = 'warning', confirmLabel = 'Mengerti' }) {
  if (!open) return null;

  const meta = ICON_MAP[type] || ICON_MAP.warning;
  const { Icon } = meta;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl text-center space-y-4 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${meta.bg} ${meta.text} shadow-inner`}>
          <Icon className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {desc && <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line text-left">{desc}</p>}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-[#5f1340] py-2.5 text-xs font-bold text-white hover:bg-[#4d0f33] transition active:scale-95 shadow-md shadow-[#5f1340]/20"
        >
          {confirmLabel}
        </button>
      </div>
    </div>,
    document.body
  );
}
