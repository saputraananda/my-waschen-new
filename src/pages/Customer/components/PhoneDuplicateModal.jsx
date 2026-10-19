import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ArrowRight, Edit3, Eye, MapPin } from 'lucide-react';
import { formatName } from '../../../utils/FormatName';

/**
 * Modal saat nomor HP sudah dipakai pelanggan lain.
 * - Outlet event: pakai data pelanggan tersebut (alamat bisa disesuaikan) lalu lanjut transaksi.
 * - Outlet biasa: lihat / edit pelanggan tersebut.
 */
export default function PhoneDuplicateModal({
  existing,
  isEvent = false,
  suggestedAddress = '',
  saving = false,
  onClose,
  onView,
  onEdit,
  onUse
}) {
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (existing) setAddress(suggestedAddress || existing.full_address || '');
  }, [existing, suggestedAddress]);

  if (!existing) return null;

  const currentAddress = existing.full_address || '';
  const addressChanged = address.trim() !== currentAddress.trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={saving ? undefined : onClose}
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
          <p className="text-xs text-slate-400 leading-relaxed">
            {isEvent
              ? 'Pelanggan ini sudah punya data. Pakai data yang ada supaya riwayat & spending tetap satu.'
              : 'Nomor ini sudah dipakai pelanggan berikut.'}
          </p>
        </div>

        <div className="rounded-xl border border-[#e0e0e0] bg-[#f8f8f8] p-3 text-xs space-y-1 break-words">
          <div className="font-extrabold text-[#313030]">{formatName(existing.name)}</div>
          <div className="text-slate-500">{existing.customer_code || existing.id} · {existing.phone}</div>
          {existing.outlet_name && <div className="text-slate-500">Terdaftar di: <strong>{existing.outlet_name}</strong></div>}
          {!isEvent && (
            <div className="text-slate-500">Alamat: {currentAddress || '-'}</div>
          )}
        </div>

        {isEvent && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#5f1340] uppercase tracking-wider">
              <MapPin className="h-3.5 w-3.5" /> Alamat
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              disabled={saving}
              placeholder="Alamat lengkap pelanggan"
              className="w-full rounded-xl border border-[#e0e0e0] bg-white px-3 py-2 text-xs text-[#313030] focus:outline-none focus:border-[#5f1340] disabled:opacity-60"
            />
            <p className="text-[10px] text-slate-400">
              {addressChanged
                ? `Alamat akan diperbarui. Sebelumnya: ${currentAddress || '-'}`
                : 'Ubah bila alamat pelanggan berbeda dari data sebelumnya.'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          {isEvent ? (
            <button
              type="button"
              onClick={() => onUse?.(existing, addressChanged ? address.trim() : null)}
              disabled={saving}
              className="col-span-2 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#5f1340] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#4d0f33] transition active:scale-95 shadow-md shadow-[#5f1340]/20 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : <>Pakai Customer Ini <ArrowRight className="h-3.5 w-3.5 shrink-0" /></>}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onView?.(existing)}
              className="col-span-2 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#5f1340] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#4d0f33] transition active:scale-95 shadow-md shadow-[#5f1340]/20"
            >
              <Eye className="h-3.5 w-3.5 shrink-0" /> Lihat Customer
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => onEdit?.(existing)}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[#5f1340]/30 bg-white px-3 py-2.5 text-xs font-bold text-[#5f1340] hover:bg-[#5f1340]/5 transition active:scale-95 disabled:opacity-50"
          >
            <Edit3 className="h-3.5 w-3.5 shrink-0" /> Edit Customer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
