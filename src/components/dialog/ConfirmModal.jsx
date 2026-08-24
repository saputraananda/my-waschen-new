import React from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertCircle, HelpCircle } from 'lucide-react';

const ICON_MAP = {
  danger: { Icon: Trash2, bg: 'bg-rose-50', text: 'text-rose-600', btn: 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' },
  warning: { Icon: AlertCircle, bg: 'bg-amber-50', text: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' },
  primary: { Icon: HelpCircle, bg: 'bg-[#5f1340]/10', text: 'text-[#5f1340]', btn: 'bg-[#5f1340] hover:bg-[#4d0f33] shadow-[#5f1340]/20' }
};

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  desc,
  loading = false,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger'
}) {
  if (!open) return null;

  const meta = ICON_MAP[variant] || ICON_MAP.danger;
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
          {desc && <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition active:scale-95 shadow-md disabled:opacity-50 ${meta.btn}`}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
