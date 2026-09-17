import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Printer, X, Bluetooth, BluetoothOff, Cable } from 'lucide-react';
import { useAppDialog } from '../context/AppDialogContext.jsx';
import { useThermalPrinter } from '../context/ThermalPrinterContext.jsx';
import { buildMergeNotaModel } from '../utils/mergeNotaModel.js';
import ThermalNotaBody from './ThermalNotaBody.jsx';

/**
 * Modal cetak thermal 58mm untuk Struk Pelunasan Gabungan (Merged Nota).
 * Dipakai setelah Proses & Cetak Nota Gabungan berhasil.
 */
export default function ThermalNotaMerge({
  batchData,
  onClose,
  outletName,
  customerName,
  customerPhone
}) {
  const navigate = useNavigate();
  const { showAlert } = useAppDialog();
  const {
    supported,
    connected,
    connecting,
    connect,
    printMergeNota
  } = useThermalPrinter();
  const [printing, setPrinting] = useState(false);

  const rows = useMemo(() => {
    if (!batchData) return [];
    return buildMergeNotaModel(batchData, {
      outletName,
      customerName,
      customerPhone
    });
  }, [batchData, outletName, customerName, customerPhone]);

  useEffect(() => {
    if (!batchData) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [batchData]);

  if (!batchData) return null;

  const batchNo = batchData.batchNo || batchData.batch_no || '-';
  const itemCount = (batchData.settledTransactions || batchData.items || []).length;

  const handleClose = () => {
    if (onClose) onClose();
  };

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      if (err?.name === 'NotFoundError') return;
      await showAlert({
        title: 'Gagal Hubungkan',
        message: err?.message || 'Tidak bisa menghubungkan printer',
        type: 'error',
        confirmLabel: 'OK'
      });
    }
  };

  const handlePrint = async () => {
    if (!connected) {
      await showAlert({
        title: 'Printer Belum Terhubung',
        message: 'Hubungkan thermal printer dulu, atau buka Setting Printer.',
        type: 'warning',
        confirmLabel: 'OK'
      });
      return;
    }
    setPrinting(true);
    try {
      await printMergeNota(batchData, {
        outletName,
        customerName,
        customerPhone
      });
    } catch (err) {
      await showAlert({
        title: 'Gagal Cetak',
        message: err?.message || 'Gagal mengirim data ke printer',
        type: 'error',
        confirmLabel: 'OK'
      });
    } finally {
      setPrinting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[130] bg-[#313030]/60 backdrop-blur-xs overflow-y-auto overscroll-contain"
      onClick={handleClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-fade-in min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8] rounded-t-3xl">
            <div className="flex items-center gap-2 min-w-0">
              <Printer className="h-5 w-5 text-[#5f1340] shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-black text-[#313030]">Cetak Nota Gabungan Thermal 58mm</h3>
                <p className="text-[10px] text-slate-500 font-bold truncate">
                  {batchNo} · {itemCount} nota dilunasi
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 text-slate-400 hover:text-[#313030] cursor-pointer shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className={`shrink-0 px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 ${
            connected ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
          }`}>
            <div className="flex items-center gap-2 text-xs font-bold">
              {connected
                ? <Bluetooth className="h-4 w-4 text-emerald-600" />
                : <BluetoothOff className="h-4 w-4 text-amber-600" />}
              <span className={connected ? 'text-emerald-800' : 'text-amber-800'}>
                {connected ? 'Printer terhubung' : 'Printer belum terhubung'}
              </span>
            </div>
            <div className="flex gap-2">
              {!connected && supported && (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="px-3 py-1.5 rounded-lg bg-[#5f1340] text-white text-[10px] font-black flex items-center gap-1 cursor-pointer"
                >
                  <Cable className="h-3 w-3" />
                  {connecting ? 'Menghubungkan…' : 'Hubungkan'}
                </button>
              )}
              {!connected && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    navigate('/settings/printer');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#5f1340]/30 text-[#5f1340] text-[10px] font-black cursor-pointer"
                >
                  Setting Printer
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[#ece9e4] py-5 px-4 sm:px-6">
            <div className="w-full max-w-[280px] mx-auto flex flex-col items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#5f1340] bg-white/80 px-2.5 py-1 rounded-lg border border-[#5f1340]/15">
                Struk Pelunasan Gabungan
              </span>
              <ThermalNotaBody rows={rows} />
            </div>
          </div>

          <div className="shrink-0 p-4 bg-[#f8f8f8] border-t border-[#e0e0e0] rounded-b-3xl space-y-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={!connected || printing}
              className="w-full py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Printer className="h-4 w-4 shrink-0" />
              <span>
                {!connected
                  ? 'Hubungkan Printer Dulu untuk Cetak'
                  : printing
                    ? 'Mencetak…'
                    : 'Cetak ke Printer Thermal'}
              </span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs cursor-pointer"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
