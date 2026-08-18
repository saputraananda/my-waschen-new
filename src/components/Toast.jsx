import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function Toast({ isOpen, onClose, title, message, type = 'success' }) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-bounce-short max-w-sm w-full bg-white rounded-xl shadow-xl border border-slate-200 p-4 flex gap-3 items-start transform transition-all duration-300">
      {type === 'success' ? (
        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
        </div>
      ) : (
        <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
        </div>
      )}
      <div className="flex-grow">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{message}</p>
      </div>
      <button 
        onClick={onClose} 
        className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-50 rounded-lg"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
