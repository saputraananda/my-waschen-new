import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Printer, X, Bluetooth, BluetoothOff, Cable } from 'lucide-react';
import { useAppDialog } from '../context/AppDialogContext.jsx';
import { useThermalPrinter } from '../context/ThermalPrinterContext.jsx';
import {
  DEFAULT_CUSTOMER_SETTINGS,
  DEFAULT_INTERNAL_SETTINGS,
  fetchPrinterSettings
} from '../utils/printerSettings.js';
import ThermalNotaBody from './ThermalNotaBody.jsx';

/**
 * Modal cetak thermal — menampilkan & mencetak 2 nota wajib:
 * 1. Nota Internal (tanpa harga, ringkas)
 * 2. Nota Customer (+ PERHATIAN sesuai setting)
 * Cetak hanya jika printer sudah terhubung (Web Serial).
 */
export default function ThermalNota({ createdOrderReceipt, onClose }) {
  const navigate = useNavigate();
  const { showAlert } = useAppDialog();
  const {
    supported,
    connected,
    connecting,
    connect,
    printNota
  } = useThermalPrinter();
  const [settings, setSettings] = useState({
    customer: DEFAULT_CUSTOMER_SETTINGS,
    internal: DEFAULT_INTERNAL_SETTINGS
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [printing, setPrinting] = useState(null); // 'internal' | 'customer'

  useEffect(() => {
    if (!createdOrderReceipt) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [createdOrderReceipt]);

  useEffect(() => {
    if (!createdOrderReceipt) return undefined;
    let cancelled = false;
    (async () => {
      setLoadingSettings(true);
      const data = await fetchPrinterSettings(localStorage.getItem('activeOutletId'));
      if (!cancelled) {
        setSettings({
          customer: data.customer,
          internal: data.internal
        });
        setLoadingSettings(false);
      }
    })();
    return () => { cancelled = true; };
  }, [createdOrderReceipt]);

  if (!createdOrderReceipt) return null;

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

  const ensureConnected = async () => {
    if (!connected) {
      await showAlert({
        title: 'Printer Belum Terhubung',
        message: 'Hubungkan thermal printer dulu, atau buka Setting Printer.',
        type: 'warning',
        confirmLabel: 'OK'
      });
      return false;
    }
    return true;
  };

  const handlePrintVariant = async (variant) => {
    if (!(await ensureConnected())) return;
    setPrinting(variant);
    try {
      const variantSettings = variant === 'internal' ? settings.internal : settings.customer;
      await printNota(createdOrderReceipt, variantSettings, variant);
      await showAlert({
        title: 'Struk Dikirim',
        message: `Nota ${variant === 'internal' ? 'Internal' : 'Customer'} berhasil dikirim ke printer thermal.`,
        type: 'success',
        confirmLabel: 'Selesai'
      });
    } catch (err) {
      await showAlert({
        title: 'Gagal Cetak',
        message: err?.message || 'Gagal mengirim data ke printer',
        type: 'error',
        confirmLabel: 'OK'
      });
    } finally {
      setPrinting(null);
    }
  };

  const printDisabled = loadingSettings || !connected || Boolean(printing);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-[#313030]/60 backdrop-blur-xs overflow-y-auto overscroll-contain"
      onClick={handleClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] animate-fade-in min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8] rounded-t-3xl">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-[#5f1340]" />
              <div>
                <h3 className="text-sm font-black text-[#313030]">Cetak Nota Thermal 58mm</h3>
                <p className="text-[10px] text-slate-500 font-bold">Pilih nota Internal atau Customer untuk dicetak</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 text-slate-400 hover:text-[#313030] cursor-pointer"
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
            {loadingSettings ? (
              <p className="text-center text-xs text-slate-500 font-bold py-10">Memuat setting printer…</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 justify-items-center min-w-0">
                <div className="w-full max-w-[280px] min-w-0 flex flex-col items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#5f1340] bg-white/80 px-2.5 py-1 rounded-lg border border-[#5f1340]/15">
                    Nota Internal
                  </span>
                  <ThermalNotaBody
                    receipt={createdOrderReceipt}
                    settings={settings.internal}
                    variant="internal"
                  />
                </div>
                <div className="w-full max-w-[280px] min-w-0 flex flex-col items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200">
                    Nota Customer
                  </span>
                  <ThermalNotaBody
                    receipt={createdOrderReceipt}
                    settings={settings.customer}
                    variant="customer"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 p-4 bg-[#f8f8f8] border-t border-[#e0e0e0] rounded-b-3xl space-y-2">
            {!connected ? (
              <button
                type="button"
                disabled
                className="w-full py-2.5 bg-slate-300 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Printer className="h-4 w-4" />
                Hubungkan Printer Dulu untuk Cetak
              </button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintVariant('internal')}
                  disabled={printDisabled}
                  className="w-full py-2.5 bg-white border-2 border-[#5f1340] text-[#5f1340] hover:bg-[#5f1340]/5 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="h-4 w-4 shrink-0" />
                  <span>{printing === 'internal' ? 'Mencetak…' : 'Cetak Nota Internal'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintVariant('customer')}
                  disabled={printDisabled}
                  className="w-full py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Printer className="h-4 w-4 shrink-0" />
                  <span>{printing === 'customer' ? 'Mencetak…' : 'Cetak Nota Customer'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
