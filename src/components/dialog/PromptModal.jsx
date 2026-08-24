import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PencilLine } from 'lucide-react';

export default function PromptModal({
  open,
  onClose,
  onSubmit,
  title,
  desc,
  defaultValue = '',
  placeholder = '',
  inputLabel = 'Nominal',
  submitLabel = 'Simpan',
  cancelLabel = 'Batal',
  inputMode = 'text'
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  if (!open) return null;

  const handleSubmit = () => {
    onSubmit(value.trim());
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#5f1340]/10 text-[#5f1340] shadow-inner">
            <PencilLine className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {desc && <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>}
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            {inputLabel}
          </label>
          <input
            type="text"
            inputMode={inputMode}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#5f1340] focus:ring-1 focus:ring-[#5f1340]"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 rounded-xl bg-[#5f1340] py-2.5 text-xs font-bold text-white hover:bg-[#4d0f33] transition active:scale-95 shadow-md shadow-[#5f1340]/20"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
