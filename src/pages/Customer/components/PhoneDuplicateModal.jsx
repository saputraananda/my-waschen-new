import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Edit3, Eye } from 'lucide-react';
import { formatName } from '../../../utils/FormatName';

/**
 * Modal saat nomor HP sudah dipakai pelanggan lain: lihat / edit pelanggan tersebut.
 * Berlaku sama untuk semua outlet (termasuk Drop Point).
 */
export default function PhoneDuplicateModal({
  existing,
  onClose,
  onView,
  onEdit
}) {
  if (!existing) return null;

  const currentAddress = existing.full_address || '';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xl space-y-4 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shadow-inner">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Nomor HP Sudah Terdaftar</h3>
          <p className="text-xs text-slate-400 leading-relaxed">Nomor ini sudah dipakai pelanggan berikut.</p>
        </div>

        <div className="rounded-xl border border-[#e0e0e0] bg-[#f8f8f8] p-3 text-xs space-y-1 break-words">
          <div className="font-extrabold text-[#313030]">{formatName(existing.name)}</div>
          <div className="text-slate-500">{existing.customer_code || existing.id} · {existing.phone}</div>
          {existing.outlet_name && <div className="text-slate-500">Terdaftar di: <strong>{existing.outlet_name}</strong></div>}
          <div className="text-slate-500">Alamat: {currentAddress || '-'}</div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => onView?.(existing)}
            className="col-span-2 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#5f1340] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#4d0f33] transition active:scale-95 shadow-md shadow-[#5f1340]/20"
          >
            <Eye className="h-3.5 w-3.5 shrink-0" /> Lihat Customer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition active:scale-95"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => onEdit?.(existing)}
            className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#5f1340]/30 bg-white px-3 py-2.5 text-xs font-bold text-[#5f1340] hover:bg-[#5f1340]/5 transition active:scale-95"
          >
            <Edit3 className="h-3.5 w-3.5 shrink-0" /> Edit Customer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
