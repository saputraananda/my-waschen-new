import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Loader2, SignalLow, WifiOff } from 'lucide-react';
import { getNetworkSnapshot, subscribeNetwork, verifyConnection } from '../utils/networkStatus.js';

const pillCls = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] max-w-[calc(100vw-2rem)] flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold shadow-lg';

export default function NetworkStatusModal() {
  const { status, restored, unsureWrite } = useSyncExternalStore(subscribeNetwork, getNetworkSnapshot);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (status !== 'offline') setDismissed(false);
  }, [status]);

  if (status === 'offline' && !dismissed) {
    return createPortal(
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
        <div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shadow-inner">
            <WifiOff className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800">Koneksi Terputus</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sinyal internet hilang atau server belum bisa dihubungi. Jangan muat ulang halaman supaya isian Anda tidak hilang.
            </p>
            {unsureWrite && (
              <p className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px] font-bold leading-relaxed text-left">
                Data yang terakhir disimpan belum tentu masuk. Setelah sinyal kembali, cek Riwayat sebelum mengulang agar nota tidak dobel.
              </p>
            )}
          </div>

          <p className="flex items-center justify-center gap-2 text-[11px] font-bold text-[#5f1340]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Menyambung ulang otomatis…
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-xl border border-[#e0e0e0] bg-white py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={verifyConnection}
              className="rounded-xl bg-[#5f1340] py-2.5 text-xs font-bold text-white hover:bg-[#4d0f33] transition shadow-md shadow-[#5f1340]/20 cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (status === 'offline') {
    return createPortal(
      <div role="status" className={`${pillCls} bg-rose-50 border-rose-200 text-rose-700`}>
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>Koneksi terputus, menyambung ulang…</span>
      </div>,
      document.body
    );
  }

  if (status === 'slow') {
    return createPortal(
      <div role="status" className={`${pillCls} bg-amber-50 border-amber-200 text-amber-800`}>
        <SignalLow className="h-4 w-4 shrink-0" />
        <span>Sinyal lambat, mohon tunggu sebentar…</span>
      </div>,
      document.body
    );
  }

  if (restored) {
    return createPortal(
      <div role="status" className={`${pillCls} bg-emerald-50 border-emerald-200 text-emerald-700`}>
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Koneksi kembali normal</span>
      </div>,
      document.body
    );
  }

  return null;
}
