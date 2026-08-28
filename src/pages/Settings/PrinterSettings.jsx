import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import ThermalNotaBody from '../../components/ThermalNotaBody.jsx';
import { useAppDialog } from '../../context/AppDialogContext.jsx';
import { useThermalPrinter } from '../../context/ThermalPrinterContext.jsx';
import {
  FIELD_LABELS,
  DEFAULT_CUSTOMER_SETTINGS,
  DEFAULT_INTERNAL_SETTINGS,
  fetchPrinterSettings,
  fetchLatestReceiptFromDb
} from '../../utils/printerSettings.js';
import { Printer, Save, RotateCcw, Bluetooth, BluetoothOff, Cable, RefreshCcw } from 'lucide-react';

export default function PrinterSettings() {
  const navigate = useNavigate();
  const { showAlert } = useAppDialog();
  const {
    supported,
    connected,
    connecting,
    lastError,
    connect,
    disconnect,
    printNota,
    printDualNota
  } = useThermalPrinter();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || '');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '2');
  const [outlets, setOutlets] = useState([]);
  const [activeTab, setActiveTab] = useState('customer');
  const [customer, setCustomer] = useState({ ...DEFAULT_CUSTOMER_SETTINGS });
  const [internal, setInternal] = useState({ ...DEFAULT_INTERNAL_SETTINGS });
  const [fieldLabels, setFieldLabels] = useState(FIELD_LABELS);
  const [loading, setLoading] = useState(true);
  const [loadingReceipt, setLoadingReceipt] = useState(true);
  const [previewReceipt, setPreviewReceipt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    document.title = 'Setting Printer | Waschen Laundry';
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    const isHq = localStorage.getItem('companyId') === '1';
    setUserProfile({
      fullName: localStorage.getItem('fullName') || 'Kasir Waschen',
      role: isHq ? 'Management Alora' : (localStorage.getItem('activeRole') || 'Staff Kasir')
    });
    axios.get('/api/masters/outlets')
      .then((res) => {
        if (res.data?.success) setOutlets(res.data.data || []);
      })
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadingReceipt(true);
      const data = await fetchPrinterSettings(activeOutletId);
      if (cancelled) return;
      setCustomer(data.customer);
      setInternal(data.internal);
      setFieldLabels(data.fieldLabels || FIELD_LABELS);
      setLoading(false);

      try {
        const receipt = await fetchLatestReceiptFromDb(activeOutletId, activeOutletName);
        if (!cancelled) setPreviewReceipt(receipt);
      } catch (err) {
        console.error('Gagal memuat transaksi preview:', err);
        if (!cancelled) setPreviewReceipt(null);
      } finally {
        if (!cancelled) setLoadingReceipt(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeOutletId, activeOutletName]);

  const reloadPreviewReceipt = async () => {
    setLoadingReceipt(true);
    try {
      const receipt = await fetchLatestReceiptFromDb(activeOutletId, activeOutletName);
      setPreviewReceipt(receipt);
      if (!receipt) {
        await showAlert({
          title: 'Tidak Ada Transaksi',
          message: 'Belum ada transaksi di outlet ini untuk dipakai sebagai preview nota.',
          type: 'warning',
          confirmLabel: 'OK'
        });
      }
    } catch (err) {
      setPreviewReceipt(null);
      await showAlert({
        title: 'Gagal Memuat',
        message: err?.message || 'Gagal mengambil transaksi dari database',
        type: 'error',
        confirmLabel: 'OK'
      });
    } finally {
      setLoadingReceipt(false);
    }
  };

  const current = activeTab === 'customer' ? customer : internal;
  const setCurrent = activeTab === 'customer' ? setCustomer : setInternal;

  const toggleField = (key) => {
    setCurrent((prev) => ({
      ...prev,
      [key]: Number(prev[key]) === 1 ? 0 : 1
    }));
  };

  const resetDefaults = () => {
    if (activeTab === 'customer') setCustomer({ ...DEFAULT_CUSTOMER_SETTINGS });
    else setInternal({ ...DEFAULT_INTERNAL_SETTINGS });
  };

  const handleConnect = async () => {
    try {
      await connect();
      await showAlert({
        title: 'Printer Terhubung',
        message: 'Thermal printer siap digunakan. Silakan Test Print.',
        type: 'success',
        confirmLabel: 'OK'
      });
    } catch (err) {
      if (err?.name === 'NotFoundError') return;
      await showAlert({
        title: 'Gagal Hubungkan',
        message: err?.message || lastError || 'Tidak bisa menghubungkan printer',
        type: 'error',
        confirmLabel: 'OK'
      });
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    await showAlert({
      title: 'Terputus',
      message: 'Koneksi thermal printer diputus.',
      type: 'info',
      confirmLabel: 'OK'
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put('/api/printer-settings', {
        outletId: Number(activeOutletId) || 0,
        customer,
        internal
      });
      if (res.data?.success) {
        await showAlert({
          title: 'Tersimpan',
          message: 'Setting tampilan thermal nota berhasil disimpan.',
          type: 'success',
          confirmLabel: 'OK'
        });
      } else {
        await showAlert({
          title: 'Gagal',
          message: res.data?.message || 'Gagal menyimpan setting',
          type: 'error',
          confirmLabel: 'OK'
        });
      }
    } catch (err) {
      await showAlert({
        title: 'Gagal',
        message: err.response?.data?.message || err.message || 'Gagal menyimpan',
        type: 'error',
        confirmLabel: 'OK'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    if (!connected) {
      await showAlert({
        title: 'Printer Belum Terhubung',
        message: 'Hubungkan thermal printer dulu (tombol Hubungkan Printer), baru Test Print.',
        type: 'warning',
        confirmLabel: 'OK'
      });
      return;
    }
    if (!previewReceipt) {
      await showAlert({
        title: 'Tidak Ada Data',
        message: 'Belum ada transaksi di database untuk di-test print. Buat transaksi dulu.',
        type: 'warning',
        confirmLabel: 'OK'
      });
      return;
    }
    setPrinting(true);
    try {
      const settings = activeTab === 'internal' ? internal : customer;
      const label = activeTab === 'internal' ? 'Internal' : 'Customer';
      await printNota(previewReceipt, settings, activeTab);
      await showAlert({
        title: 'Test Print Berhasil',
        message: `Nota ${label} dikirim ke printer.\nNota: ${previewReceipt.id}\nOutlet: ${previewReceipt.branch || activeOutletName || 'Waschen'}`,
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
      setPrinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#313030] flex flex-col font-sans">
      <HeaderNav
        activeOutletName={activeOutletName}
        setActiveOutletName={setActiveOutletName}
        activeOutletId={activeOutletId}
        setActiveOutletId={setActiveOutletId}
        outlets={outlets}
        userProfile={userProfile}
      />

      <main className="max-w-[1200px] w-full mx-auto px-3 py-4 sm:p-6 flex-grow flex flex-col gap-4 sm:gap-5 min-w-0">
        <div className="bg-white border border-[#e0e0e0] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 sm:p-3 bg-[#5f1340]/10 text-[#5f1340] rounded-2xl shrink-0">
              <Printer className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight truncate">Setting Printer Thermal</h1>
              <p className="text-[11px] sm:text-xs text-slate-500 font-bold mt-0.5">
                Custom tampilan nota 58mm — Customer & Internal
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 w-full">
            <button
              type="button"
              onClick={resetDefaults}
              className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-[#e0e0e0] text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Default
            </button>
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={printing || !connected || !previewReceipt}
              className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-[#5f1340]/30 text-xs font-bold text-[#5f1340] hover:bg-[#5f1340]/5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              {printing ? 'Mencetak…' : `Test Print ${activeTab === 'internal' ? 'Internal' : 'Customer'}`}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#5f1340] hover:bg-[#4d0f33] disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Menyimpan…' : 'Simpan Setting'}
            </button>
          </div>
        </div>

        <div className={`border rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col gap-3 sm:flex-row sm:gap-4 sm:items-center sm:justify-between min-w-0 ${
          connected
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-white border-[#e0e0e0]'
        }`}>
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={`p-2.5 sm:p-3 rounded-2xl shrink-0 ${
              connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {connected ? <Bluetooth className="h-5 w-5" /> : <BluetoothOff className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-[#313030]">
                Status: {connected ? 'Terhubung' : 'Belum Terhubung'}
              </p>
              <p className="text-[11px] text-slate-500 font-semibold mt-1 leading-relaxed break-words">
                {!supported
                  ? 'Browser ini tidak mendukung Web Serial. Gunakan Chrome / Edge di komputer kasir.'
                  : connected
                    ? 'Printer siap menerima perintah cetak ESC/POS (nota Internal + Customer).'
                    : 'Pair printer di Windows dulu (RPP02N / sejenis), lalu klik Hubungkan dan pilih port Serial / Bluetooth.'}
              </p>
              {lastError && !connected && (
                <p className="text-[11px] text-rose-600 font-bold mt-1 whitespace-pre-line break-words">{lastError}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:shrink-0">
            {connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-black hover:bg-rose-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <BluetoothOff className="h-3.5 w-3.5" />
                Putuskan
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={!supported || connecting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#5f1340] hover:bg-[#4d0f33] disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Cable className="h-3.5 w-3.5" />
                {connecting ? 'Menghubungkan…' : 'Hubungkan Printer'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 min-w-0">
          <div className="bg-white border border-[#e0e0e0] rounded-2xl sm:rounded-3xl shadow-xs overflow-hidden flex flex-col min-w-0">
            <div className="flex border-b border-[#e0e0e0]">
              <button
                type="button"
                onClick={() => setActiveTab('customer')}
                className={`flex-1 py-3 px-2 text-[10px] sm:text-xs font-black uppercase tracking-wider cursor-pointer transition-colors ${
                  activeTab === 'customer'
                    ? 'bg-[#5f1340]/8 text-[#5f1340] border-b-2 border-[#5f1340]'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Nota Customer
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('internal')}
                className={`flex-1 py-3 px-2 text-[10px] sm:text-xs font-black uppercase tracking-wider cursor-pointer transition-colors ${
                  activeTab === 'internal'
                    ? 'bg-[#5f1340]/8 text-[#5f1340] border-b-2 border-[#5f1340]'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Nota Internal
              </button>
            </div>

            <div className="p-3 sm:p-5 flex-1 min-w-0">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider mb-3">
                Tampilkan di Nota {activeTab === 'customer' ? 'Customer' : 'Internal'}
              </p>
              {loading ? (
                <p className="text-xs text-slate-500 font-bold py-8 text-center">Memuat setting…</p>
              ) : (
                <div className="space-y-1.5 max-h-[min(520px,55vh)] overflow-y-auto overscroll-contain pr-1">
                  {fieldLabels.map(({ key, label }) => {
                    const checked = Number(current[key]) === 1;
                    return (
                      <label
                        key={key}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-[#e0e0e0] hover:border-[#5f1340]/30 hover:bg-[#5f1340]/3 cursor-pointer transition-colors min-w-0"
                      >
                        <span className="text-xs font-bold text-[#313030] min-w-0 break-words">{label}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleField(key)}
                          className="h-4 w-4 accent-[#5f1340] cursor-pointer shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              )}
              {activeTab === 'internal' && (
                <p className="mt-3 text-[10px] text-slate-500 font-semibold leading-relaxed">
                  Default internal: tanpa harga, total, pembayaran, dan PERHATIAN — lebih ringkas untuk operasional outlet.
                </p>
              )}
            </div>
          </div>

          <div className="bg-[#ece9e4] border border-[#e0e0e0] rounded-2xl sm:rounded-3xl shadow-xs p-3 sm:p-5 flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="w-full flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Preview {activeTab === 'customer' ? 'Customer' : 'Internal'}
                </p>
                <p className="text-[9px] font-bold text-slate-400 truncate">
                  {previewReceipt
                    ? `Data DB · ${previewReceipt.id}`
                    : 'Data dari transaksi terbaru outlet'}
                </p>
              </div>
              <button
                type="button"
                onClick={reloadPreviewReceipt}
                disabled={loadingReceipt}
                className="shrink-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[10px] font-black text-slate-600 hover:bg-slate-50 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Muat ulang transaksi terbaru"
              >
                <RefreshCcw className={`h-3 w-3 ${loadingReceipt ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            <div className="w-full min-w-0 overflow-x-auto overscroll-contain flex justify-center">
              {loadingReceipt ? (
                <p className="text-xs text-slate-500 font-bold py-16">Memuat transaksi dari database…</p>
              ) : !previewReceipt ? (
                <div className="text-center py-12 px-4">
                  <p className="text-xs font-bold text-slate-500">Belum ada transaksi di outlet ini.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Buat transaksi dulu, lalu klik Refresh.</p>
                </div>
              ) : (
                <ThermalNotaBody
                  receipt={previewReceipt}
                  settings={current}
                  variant={activeTab}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
