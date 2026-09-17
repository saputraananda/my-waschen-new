import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Printer, X, Bluetooth, BluetoothOff, Cable, Receipt, Layers } from 'lucide-react';
import { useAppDialog } from '../context/AppDialogContext.jsx';
import { useThermalPrinter } from '../context/ThermalPrinterContext.jsx';
import {
  DEFAULT_CUSTOMER_SETTINGS,
  DEFAULT_INTERNAL_SETTINGS,
  fetchPrinterSettings
} from '../utils/printerSettings.js';
import { buildMergeNotaModel } from '../utils/mergeNotaModel.js';
import ThermalNotaBody from './ThermalNotaBody.jsx';

/**
 * Modal cetak thermal 58mm.
 * - Default: Nota Internal + Nota Customer (per nota individu)
 * - Jika transaksi punya paymentBatchNo (pelunasan gabungan):
 *   ada pilihan Cetak Nota Gabungan vs Cetak Nota Individu
 */
export default function ThermalNota({ createdOrderReceipt, onClose }) {
  const navigate = useNavigate();
  const { showAlert } = useAppDialog();
  const {
    supported,
    connected,
    connecting,
    connect,
    printNota,
    printMergeNota
  } = useThermalPrinter();
  const [settings, setSettings] = useState({
    customer: DEFAULT_CUSTOMER_SETTINGS,
    internal: DEFAULT_INTERNAL_SETTINGS
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [printing, setPrinting] = useState(null); // 'internal' | 'customer' | 'merge'
  const [printMode, setPrintMode] = useState('individu'); // 'individu' | 'gabungan'
  const [batchData, setBatchData] = useState(null);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [batchError, setBatchError] = useState('');

  const batchNo =
    createdOrderReceipt?.paymentBatchNo ||
    createdOrderReceipt?.payment_batch_no ||
    null;
  const hasMergedBatch = Boolean(batchNo);

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

  // Reset mode + load batch bila nota gabungan terdeteksi
  useEffect(() => {
    if (!createdOrderReceipt) return undefined;
    setPrintMode('individu');
    setBatchData(null);
    setBatchError('');

    if (!batchNo) return undefined;

    let cancelled = false;
    (async () => {
      setLoadingBatch(true);
      try {
        const res = await axios.get(`/api/transactions/batch/${encodeURIComponent(batchNo)}`);
        if (cancelled) return;
        if (res.data?.success && res.data.data) {
          setBatchData({
            ...res.data.data,
            outletName:
              res.data.data.outletName ||
              res.data.data.outlet_name ||
              createdOrderReceipt.branch,
            customerName:
              res.data.data.customerName ||
              res.data.data.customer_name ||
              createdOrderReceipt.customerName,
            customerPhone:
              res.data.data.customerPhone ||
              res.data.data.customer_phone ||
              createdOrderReceipt.customerPhone
          });
        } else {
          setBatchError(res.data?.message || 'Data nota gabungan tidak ditemukan.');
        }
      } catch (err) {
        if (!cancelled) {
          setBatchError(
            err.response?.data?.message || 'Gagal memuat data nota gabungan.'
          );
        }
      } finally {
        if (!cancelled) setLoadingBatch(false);
      }
    })();

    return () => { cancelled = true; };
  }, [createdOrderReceipt, batchNo]);

  const mergeRows = useMemo(() => {
    if (!batchData) return [];
    return buildMergeNotaModel(batchData, {
      outletName: batchData.outletName || createdOrderReceipt?.branch,
      customerName: batchData.customerName || createdOrderReceipt?.customerName,
      customerPhone: batchData.customerPhone || createdOrderReceipt?.customerPhone
    });
  }, [batchData, createdOrderReceipt]);

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

  const handlePrintMerge = async () => {
    if (!(await ensureConnected())) return;
    if (!batchData) {
      await showAlert({
        title: 'Data Belum Siap',
        message: batchError || 'Data nota gabungan belum tersedia.',
        type: 'warning',
        confirmLabel: 'OK'
      });
      return;
    }
    setPrinting('merge');
    try {
      await printMergeNota(batchData, {
        outletName: batchData.outletName || createdOrderReceipt.branch,
        customerName: batchData.customerName || createdOrderReceipt.customerName,
        customerPhone: batchData.customerPhone || createdOrderReceipt.customerPhone
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
  const showGabungan = printMode === 'gabungan' && hasMergedBatch;
  const batchLabel = batchData?.batchNo || batchData?.batch_no || batchNo;
  const itemCount = (batchData?.settledTransactions || batchData?.items || []).length;

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
            <div className="flex items-center gap-2 min-w-0">
              <Printer className="h-5 w-5 text-[#5f1340] shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-black text-[#313030]">Cetak Nota Thermal 58mm</h3>
                <p className="text-[10px] text-slate-500 font-bold truncate">
                  {hasMergedBatch
                    ? `Nota ini bagian pelunasan gabungan (${batchLabel})`
                    : 'Pilih nota Internal atau Customer untuk dicetak'}
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

          {hasMergedBatch && (
            <div className="shrink-0 px-4 py-3 border-b border-[#e0e0e0] bg-white">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                Pilih jenis cetak
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrintMode('individu')}
                  className={`px-3 py-2.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    printMode === 'individu'
                      ? 'bg-[#5f1340] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Receipt className="h-3.5 w-3.5 shrink-0" />
                  Nota Individu
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('gabungan')}
                  className={`px-3 py-2.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    printMode === 'gabungan'
                      ? 'bg-[#5f1340] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 shrink-0" />
                  Nota Gabungan
                </button>
              </div>
            </div>
          )}

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
            ) : showGabungan ? (
              loadingBatch ? (
                <p className="text-center text-xs text-slate-500 font-bold py-10">Memuat nota gabungan…</p>
              ) : batchError ? (
                <p className="text-center text-xs text-rose-600 font-bold py-10">{batchError}</p>
              ) : (
                <div className="w-full max-w-[280px] mx-auto flex flex-col items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#5f1340] bg-white/80 px-2.5 py-1 rounded-lg border border-[#5f1340]/15">
                    Struk Pelunasan Gabungan · {itemCount || '-'} nota
                  </span>
                  <ThermalNotaBody rows={mergeRows} />
                </div>
              )
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
            ) : showGabungan ? (
              <button
                type="button"
                onClick={handlePrintMerge}
                disabled={printDisabled || loadingBatch || !batchData}
                className="w-full py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Printer className="h-4 w-4 shrink-0" />
                <span>{printing === 'merge' ? 'Mencetak…' : 'Cetak Nota Gabungan'}</span>
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
