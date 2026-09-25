import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ClipboardCheck, Camera, Images, QrCode, X, Loader2, Truck, Store, MessageCircle, CheckCircle2, XCircle, PauseCircle, Plus, Trash2 } from 'lucide-react';
import HeaderNav from '../../../components/HeaderNav';
import QcCameraModal from '../../../components/QcCameraModal.jsx';
import { extractOrderNo } from '../../../utils/extractOrderNo.js';
import { burnQcPhoto, buildQcPhotoLines } from '../../../utils/qcPhotoStamp.js';

const MAX_PHOTOS = 5;
const QC_SCANNER_ID = 'qc-nota-scanner';

/** Identitas QC dibaca server dari token login, bukan PIN. */
const authCfg = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });

const STAGE_LABEL = {
  frontliner: 'Frontliner',
  washing: 'Tim Cuci',
  ironing: 'Tim Setrika',
  packing: 'Packing',
  delivery: 'Antar',
  handover: 'Serah Terima'
};

const formatDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
};

const holdWaLink = (phone, { customerName, orderNo, reportedStage, reportNotes, kiloan }) => {
  const normalized = String(phone || '').replace(/[^0-9]/g, '').replace(/^0/, '62');
  const team = STAGE_LABEL[reportedStage] || reportedStage || 'Produksi';
  let msg = `Selamat, Kak ${customerName || ''}. Kami dari Waschen ingin menginformasikan terkait nota ${orderNo || '-'}.`;
  msg += `\n\nTim ${team} kami menemukan kondisi pada cucian ${kiloan ? 'kiloan ' : ''}Kakak:`;
  msg += `\n"${reportNotes || 'Temuan pada proses pengerjaan — mohon konfirmasi.'}"`;
  msg += kiloan
    ? '\n\nUntuk hasil terbaik, kami sarankan cucian ini diproses sebagai layanan satuan. Apakah Kakak berkenan? Mohon konfirmasinya, Kak.'
    : '\n\nMohon konfirmasinya agar kami dapat melanjutkan proses, Kak. Terima kasih.';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
};

const isKiloan = (item) =>
  item?.category_code === 'KILOAN' || String(item?.unit || '').toLowerCase() === 'kg';

const stageFor = (tab, item) => {
  if (tab === 'delivery') {
    return item?.item_work_status === 'Sedang Diantar' ? 'handover' : 'delivery';
  }
  return 'frontliner';
};

const waLink = (phone, kiloan) => {
  const normalized = String(phone || '').replace(/[^0-9]/g, '').replace(/^0/, '62');
  const msg = `Selamat, Kak. Saat proses sortir sebelum pencucian, kami menemukan noda/kerusakan pada salah satu cucian ${kiloan ? 'kiloan ' : ''}Kakak. Berikut foto kondisinya sebagai referensi.`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
};

function QcSheet({ target, onClose, onSaved }) {
  const { txn, item, stage } = target;
  const handover = stage === 'handover';
  const kiloan = isKiloan(item);
  const [qcStatus, setQcStatus] = useState('aman');
  const [decision, setDecision] = useState('lanjut');
  const [notes, setNotes] = useState('');
  const [waContacted, setWaContacted] = useState(false);
  const [requiresIroning, setRequiresIroning] = useState(Number(item?.requires_ironing) !== 0);
  const [bags, setBags] = useState([{ qty: '' }]);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const photosRef = useRef([]);
  photosRef.current = photos;

  const needBags = kiloan && stage === 'frontliner';
  // Kiloan: setrika sudah ditentukan paket layanan, jangan tanya lagi di QC.
  const askIroning = stage === 'frontliner' && !kiloan;

  useEffect(() => () => {
    photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
  }, []);

  const addPhoto = async (file, { alreadyStamped = false } = {}) => {
    if (!file || photos.length >= MAX_PHOTOS) return;
    setBusy(true);
    setError('');
    try {
      const stamped = alreadyStamped ? file : await burnQcPhoto(file, { orderNo: txn.order_no, stage });
      setPhotos((prev) => [...prev, { file: stamped, preview: URL.createObjectURL(stamped) }]);
    } catch {
      setError('Gagal memproses foto.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError('');
    if (photos.length === 0) {
      setError(handover ? 'Serah terima wajib minimal 1 foto.' : 'QC wajib minimal 1 foto.');
      return;
    }
    if (needBags && bags.some((b) => !(Number(b.qty) > 0))) {
      setError('Isi jumlah pakaian di setiap plastik.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('transaction_detail_id', String(item.id));
      fd.append('stage', stage);
      fd.append('qc_status', qcStatus);
      fd.append('qc_decision', handover || qcStatus === 'aman' ? 'lanjut' : decision);
      if (notes.trim()) fd.append('notes', notes.trim());
      fd.append('wa_contacted', stage === 'frontliner' && waContacted ? '1' : '0');
      if (askIroning) fd.append('requires_ironing', requiresIroning ? '1' : '0');
      if (needBags) {
        fd.append('bags', JSON.stringify(bags.map((b, i) => ({ bag_no: i + 1, qty_pcs: Number(b.qty) }))));
      }
      photos.forEach((p) => fd.append('photos', p.file, p.file.name));
      const res = await axios.post('/api/qc/submit', fd, authCfg());
      onSaved(res.data?.message || 'QC tersimpan');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan QC');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-[#313030]/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[#e0e0e0] shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 bg-white border-b border-[#e0e0e0] px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-[#313030] break-words">{handover ? 'Serah Terima' : 'QC'} — {item.service_name}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">{txn.order_no} · {Number(item.qty)} {item.unit}</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl border border-[#e0e0e0] grid place-items-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {Number(item.has_finding) === 1 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              Temuan sebelumnya: {item.finding_note || 'Ada catatan temuan.'}
            </div>
          )}

          {needBags && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Rincian Plastik — {STAGE_LABEL[stage] || stage}</p>
              <div className="flex flex-col gap-2">
                {bags.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 w-[70px] shrink-0">Plastik {i + 1}</span>
                    <input
                      inputMode="numeric"
                      value={b.qty}
                      onChange={(e) => setBags((prev) => prev.map((row, idx) => idx === i ? { qty: e.target.value.replace(/[^\d]/g, '') } : row))}
                      placeholder="Contoh : 10"
                      className="flex-1 min-w-0 text-xs font-bold text-slate-700 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl px-3 py-2 outline-none"
                    />
                    {bags.length > 1 && (
                      <button type="button" onClick={() => setBags((prev) => prev.filter((_, idx) => idx !== i))} className="w-8 h-8 rounded-[10px] border border-red-200 bg-red-50 text-red-500 grid place-items-center shrink-0" aria-label={`Hapus plastik ${i + 1}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setBags((prev) => [...prev, { qty: '' }])} className="mt-2 text-[11px] font-extrabold text-[#5f1340] flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Tambah Plastik
              </button>
            </div>
          )}

          {askIroning && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Perlu setrika?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setRequiresIroning(true)} className={`py-2.5 rounded-xl text-xs font-black ${requiresIroning ? 'bg-[#5f1340] text-white' : 'bg-[#f8f8f8] border border-[#e0e0e0]'}`}>Ya, perlu</button>
                <button type="button" onClick={() => setRequiresIroning(false)} className={`py-2.5 rounded-xl text-xs font-black ${!requiresIroning ? 'bg-[#5f1340] text-white' : 'bg-[#f8f8f8] border border-[#e0e0e0]'}`}>Tidak, skip</button>
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{handover ? 'Kondisi serah terima' : 'Hasil QC'}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setQcStatus('aman'); setDecision('lanjut'); }} className={`py-3 rounded-2xl text-xs font-black border ${qcStatus === 'aman' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-[#f8f8f8] border-[#e0e0e0] text-slate-500'}`}>Aman</button>
              <button type="button" onClick={() => { setQcStatus('temuan'); setDecision(handover || stage === 'frontliner' ? 'lanjut' : 'kembali'); }} className={`py-3 rounded-2xl text-xs font-black border ${qcStatus === 'temuan' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-[#f8f8f8] border-[#e0e0e0] text-slate-500'}`}>Temuan</button>
            </div>
          </div>

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Catatan" className="w-full rounded-xl border border-[#e0e0e0] px-3 py-2 text-sm" />

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              {handover ? 'Foto bukti diantar (wajib)' : qcStatus === 'temuan' ? 'Foto temuan (wajib)' : 'Foto (wajib)'} · maks {MAX_PHOTOS}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-[#e0e0e0]">
                  <img src={p.preview} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setPhotos((prev) => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, idx) => idx !== i); })} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
            {photos.length < MAX_PHOTOS && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button type="button" disabled={busy} onClick={() => setCameraOpen(true)} className="py-3 rounded-2xl border border-dashed border-[#e0e0e0] text-center text-[11px] font-bold text-slate-500 disabled:opacity-50">
                  <Camera className="h-4 w-4 mx-auto mb-1" /> Kamera
                </button>
                <label className="py-3 rounded-2xl border border-dashed border-[#e0e0e0] text-center text-[11px] font-bold text-slate-500 cursor-pointer">
                  <Images className="h-4 w-4 mx-auto mb-1" /> Galeri
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addPhoto(f); }} />
                </label>
              </div>
            )}
          </div>

          {qcStatus === 'temuan' && !handover && stage === 'frontliner' && txn.customer_phone && (
            <a href={waLink(txn.customer_phone, kiloan)} target="_blank" rel="noreferrer" onClick={() => setWaContacted(true)} className="block text-center py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black">Hubungi customer via WA</a>
          )}

          {qcStatus === 'temuan' && !handover && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDecision(stage === 'frontliner' ? 'hold' : 'kembali')} className={`py-2.5 px-2 rounded-xl text-xs font-black border leading-tight ${decision !== 'lanjut' ? 'bg-amber-50 text-amber-800 border-amber-300' : 'border-[#e0e0e0]'}`}>
                {stage === 'frontliner' ? 'Hold' : 'Kembalikan ke packing'}
              </button>
              <button type="button" onClick={() => setDecision('lanjut')} className={`py-2.5 rounded-xl text-xs font-black border ${decision === 'lanjut' ? 'bg-[#5f1340] text-white border-[#5f1340]' : 'border-[#e0e0e0]'}`}>Lanjut + catatan</button>
            </div>
          )}

          {qcStatus === 'temuan' && handover && (
            <p className="text-xs text-slate-500">Temuan tetap menandai item selesai. Foto bukti tetap wajib.</p>
          )}

          {error && <p className="text-xs font-bold text-red-600">{error}</p>}

          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="w-full py-3 rounded-2xl bg-[#5f1340] text-white text-sm font-black disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {handover ? 'Tandai selesai' : 'Simpan QC'}
          </button>
        </div>
      </div>

      <QcCameraModal
        open={cameraOpen}
        title={handover ? 'Ambil Foto Serah Terima' : 'Ambil Foto QC'}
        buildOverlayLines={(date) => buildQcPhotoLines({ orderNo: txn.order_no, stage, date })}
        onCapture={(file) => { setCameraOpen(false); addPhoto(file, { alreadyStamped: true }); }}
        onClose={() => setCameraOpen(false)}
      />
    </div>
  );
}

export default function QCFrontDeliv() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'delivery' ? 'delivery' : 'frontliner');
  const [search, setSearch] = useState(params.get('order') || '');
  const [rows, setRows] = useState([]);
  const [holds, setHolds] = useState([]);
  const [showHolds, setShowHolds] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [target, setTarget] = useState(null);
  const [holdNotes, setHoldNotes] = useState({});
  const [holdBusyId, setHoldBusyId] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || '');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  const [pickup, setPickup] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState('');
  const scannerRef = useRef(null);
  const scanHandledRef = useRef(false);
  const keepErrorRef = useRef(false);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const load = useCallback(async () => {
    setLoading(true);
    if (keepErrorRef.current) keepErrorRef.current = false;
    else setError('');
    try {
      const res = await axios.get('/api/qc/list', {
        params: {
          tab,
          search,
          outlet_id: activeOutletId || localStorage.getItem('activeOutletId') || undefined,
          ...(pickup ? { pickup } : {})
        },
        ...authCfg()
      });
      setRows(res.data?.data || []);
      setHolds(res.data?.holds || []);
      if (!pickup && res.data?.pickup) setPickup(res.data.pickup);
    } catch (err) {
      setRows([]);
      setHolds([]);
      setError(err.response?.data?.message || 'Gagal memuat daftar');
    } finally {
      setLoading(false);
    }
  }, [tab, search, pickup, activeOutletId]);

  useEffect(() => {
    document.title = 'QC Frontliner & Delivery | Waschen Laundry';
    if (!localStorage.getItem('token')) {
      navigate('/login', { replace: true });
      return;
    }
    const isHq = localStorage.getItem('companyId') === '1';
    setUserProfile({
      fullName: localStorage.getItem('fullName') || 'Kasir Waschen',
      role: isHq ? 'Management Alora' : (localStorage.getItem('activeRole') || 'Staff Kasir')
    });
    axios.get('/api/masters/outlets').then((res) => {
      if (res.data?.success) setOutlets(res.data.data || []);
    }).catch(() => {});
  }, [navigate]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanOpen(false);
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch {
      /* kamera sudah tertutup */
    }
  }, []);

  const applyScan = useCallback(async (raw) => {
    const key = extractOrderNo(raw);
    await stopScanner();
    if (!key) return;
    setSearch(key);
    setPickup('all');
    setShowHolds(false);
    setError('');
    setNotice('');
    try {
      // scan selalu cari ke semua nota, jangan terhalang filter pickup
      const fetchTab = (t) => axios.get('/api/qc/list', {
        params: {
          tab: t,
          search: key,
          pickup: 'all',
          outlet_id: localStorage.getItem('activeOutletId') || undefined
        },
        ...authCfg()
      }).then((res) => res.data?.data || []);
      const [front, delivery] = await Promise.all([fetchTab('frontliner'), fetchTab('delivery')]);
      const onDelivery = tabRef.current === 'delivery';
      if (onDelivery && delivery.length) {
        setRows(delivery);
      } else if (front.length) {
        setTab('frontliner');
        setRows(front);
      } else if (delivery.length) {
        setTab('delivery');
        setRows(delivery);
      } else {
        setRows([]);
        keepErrorRef.current = true;
        setError(`Nota ${key} tidak ada di antrean QC outlet ini.`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mencari nota dari scan');
    }
  }, [stopScanner]);

  useEffect(() => {
    if (!scanOpen) return undefined;
    let cancelled = false;
    scanHandledRef.current = false;
    setScanError('');

    const start = async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (cancelled) return;
      const el = document.getElementById(QC_SCANNER_ID);
      if (el) el.innerHTML = '';
      const scanner = new Html5Qrcode(QC_SCANNER_ID, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13
        ]
      });
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: (viewW, viewH) => {
              const side = Math.floor(Math.min(viewW, viewH) * 0.72);
              return { width: Math.max(180, side), height: Math.max(180, side) };
            }
          },
          (decodedText) => {
            if (cancelled || scanHandledRef.current) return;
            if (!extractOrderNo(decodedText)) return;
            scanHandledRef.current = true;
            applyScan(decodedText);
          },
          () => {}
        );
      } catch (err) {
        scannerRef.current = null;
        if (!cancelled) {
          setScanError(String(err?.message || '').includes('NotAllowed')
            ? 'Akses kamera ditolak. Izinkan kamera lalu coba lagi.'
            : 'Tidak dapat membuka kamera.');
        }
      }
    };
    start();
    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {}).finally(() => {
          try { scanner.clear(); } catch { /* ignore */ }
        });
      }
    };
  }, [scanOpen, applyScan]);

  const resolveHold = async (hold, decision) => {
    if (decision === 'batal' && !window.confirm(
      'Yakin membatalkan item ini? Item tidak akan diproses lebih lanjut dan status menjadi Dibatalkan.'
    )) return;
    setHoldBusyId(hold.detail_id);
    setError('');
    try {
      const res = await axios.post('/api/qc/hold-resolve', {
        detailId: hold.detail_id,
        decision,
        note: (holdNotes[hold.detail_id] || '').trim()
      }, authCfg());
      setHoldNotes((prev) => ({ ...prev, [hold.detail_id]: '' }));
      setNotice(res.data?.message || 'Konfirmasi tersimpan');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyelesaikan hold');
    } finally {
      setHoldBusyId(null);
    }
  };

  const visibleItems = (txn) => (txn.items || []).filter((item) => {
    if (tab === 'delivery') return ['Siap Diantar', 'Sedang Diantar'].includes(item.item_work_status);
    return item.item_work_status === 'Antrean';
  });

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#313030] overflow-x-hidden">
      <HeaderNav
        activeOutletName={activeOutletName}
        setActiveOutletName={setActiveOutletName}
        activeOutletId={activeOutletId}
        setActiveOutletId={setActiveOutletId}
        outlets={outlets}
        userProfile={userProfile}
      />
      <main className="max-w-[1600px] w-full mx-auto p-3 sm:p-5 lg:p-6 flex flex-col gap-4 sm:gap-5">
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-black flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 text-[#5f1340] shrink-0" />
                <span className="min-w-0">QC Frontliner &amp; Delivery</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {showHolds
                  ? 'Item yang menunggu konfirmasi Anda sebelum diproses lagi.'
                  : tab === 'frontliner'
                    ? 'QC Awal: semua nota baru masuk (antar-jemput maupun ambil di outlet).'
                    : 'Antar & Serah Terima: nota yang sudah selesai packing dan siap diantar.'}
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full lg:w-[560px] lg:shrink-0">
              <div className="grid grid-cols-2 rounded-2xl bg-[#f8f8f8] p-1">
                {[['frontliner', 'QC Awal'], ['delivery', 'Antar & Serah Terima']].map(([key, label]) => (
                  <button key={key} type="button" onClick={() => { setTab(key); setShowHolds(false); }} className={`px-2 sm:px-4 py-2.5 rounded-xl text-[11px] sm:text-xs font-black transition text-center leading-tight ${tab === key && !showHolds ? 'bg-[#5f1340] text-white' : 'text-slate-500 hover:text-[#5f1340]'}`}>{label}</button>
                ))}
              </div>
              <div className="flex gap-2 min-w-0">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nota / nama / HP" className="min-w-0 flex-1 rounded-2xl border border-[#e0e0e0] px-4 py-2.5 text-sm outline-none focus:border-[#5f1340]" />
                <button type="button" onClick={() => setScanOpen(true)} className="px-4 sm:px-5 py-2.5 rounded-2xl bg-[#5f1340] text-white text-xs font-black flex items-center justify-center gap-2 shrink-0">
                  <QrCode className="h-4 w-4" /> Scan
                </button>
              </div>
            </div>
          </div>

          {tab === 'frontliner' && !showHolds && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Jenis nota</span>
              {[['all', 'Semua'], ['delivery', 'Antar-Jemput'], ['outlet', 'Ambil di Outlet']].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPickup(key)}
                  className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black border transition ${pickup === key ? 'bg-[#5f1340] text-white border-[#5f1340]' : 'bg-white border-[#e0e0e0] text-slate-500 hover:border-[#5f1340]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === 'frontliner' && (
          <button
            type="button"
            onClick={() => setShowHolds((v) => !v)}
            className={`w-full py-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition ${
              showHolds
                ? 'bg-amber-500 text-white border-amber-500'
                : holds.length > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-white text-slate-500 border-[#e0e0e0]'
            }`}
          >
            <PauseCircle className="h-4 w-4" />
            {showHolds ? 'Kembali ke daftar QC' : `Perlu Konfirmasi${holds.length > 0 ? ` (${holds.length})` : ''}`}
          </button>
        )}

        {notice && <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">{notice}</p>}
        {error && <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">{error}</p>}

        {showHolds && tab === 'frontliner' ? (
          holds.length === 0 ? (
            <div className="bg-white border border-[#e0e0e0] rounded-3xl py-16 text-center">
              <PauseCircle className="h-10 w-10 text-[#e0e0e0] mx-auto" />
              <p className="text-sm font-black mt-3">Tidak ada item yang perlu dikonfirmasi</p>
            </div>
          ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {holds.map((h) => {
                const fromOtherStage = h.reported_stage && h.reported_stage !== 'frontliner';
                const busyHold = holdBusyId === h.detail_id;
                return (
                  <div key={h.hold_id || h.detail_id} className="bg-white rounded-3xl border border-amber-200 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#313030] truncate">{h.order_no}</p>
                        <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                          {h.customer_name || 'Customer'} · {h.service_name} · {Number(h.qty)} {h.unit}
                        </p>
                      </div>
                      <span className="text-[9.5px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full shrink-0 uppercase text-center leading-tight max-w-[6.5rem]">
                        dari {STAGE_LABEL[h.reported_stage] || h.reported_stage}
                      </span>
                    </div>

                    {h.report_notes && (
                      fromOtherStage ? (
                        <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
                          <p className="text-[9.5px] font-black text-amber-700 uppercase tracking-wider mb-1">
                            Catatan dari {STAGE_LABEL[h.reported_stage] || h.reported_stage}
                          </p>
                          <p className="text-[11.5px] text-slate-700 font-medium leading-relaxed">{h.report_notes}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-[11.5px] text-slate-600 font-medium bg-[#f8f8f8] rounded-xl px-3 py-2">{h.report_notes}</p>
                      )
                    )}

                    <p className="mt-1.5 text-[10px] text-slate-400 font-bold">
                      Dilaporkan {h.reported_by || '-'} · {formatDateTime(h.reported_at)}
                    </p>

                    {h.photos?.length > 0 && (
                      <div className="mt-2 flex gap-2 overflow-x-auto">
                        {h.photos.map((p, pi) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPhotoPreview({ url: p.photo_url, title: `Bukti Temuan — ${h.order_no} (${pi + 1}/${h.photos.length})` })}
                            aria-label={`Preview bukti temuan ${pi + 1}`}
                            className="shrink-0 rounded-xl overflow-hidden border border-[#e0e0e0]"
                          >
                            <img src={p.photo_url} alt="Bukti temuan" className="w-16 h-16 object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    {fromOtherStage && h.customer_phone && (
                      <a
                        href={holdWaLink(h.customer_phone, {
                          customerName: h.customer_name,
                          orderNo: h.order_no,
                          reportedStage: h.reported_stage,
                          reportNotes: h.report_notes,
                          kiloan: isKiloan(h)
                        })}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 w-full py-3 rounded-2xl bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="h-4 w-4" /> Hubungi Customer via WA
                      </a>
                    )}

                    <input
                      type="text"
                      placeholder="Contoh : Sudah konfirmasi ke customer"
                      value={holdNotes[h.detail_id] || ''}
                      onChange={(e) => setHoldNotes((prev) => ({ ...prev, [h.detail_id]: e.target.value }))}
                      className="mt-3 w-full text-xs font-medium text-slate-700 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl px-3 py-2.5 outline-none focus:border-[#5f1340]"
                    />

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busyHold}
                        onClick={() => resolveHold(h, 'batal')}
                        className="min-h-10 h-auto px-2 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-[11px] sm:text-xs font-black flex items-center justify-center gap-1.5 text-center leading-tight disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" /> Batalkan Item
                      </button>
                      <button
                        type="button"
                        disabled={busyHold}
                        onClick={() => resolveHold(h, 'lanjut')}
                        className="min-h-10 h-auto px-2 py-2 rounded-xl bg-emerald-500 text-white text-[11px] sm:text-xs font-black flex items-center justify-center gap-1.5 text-center leading-tight disabled:opacity-50"
                      >
                        {busyHold ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Lanjutkan</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white border border-[#e0e0e0] rounded-3xl p-5 animate-pulse">
                <div className="h-4 w-32 rounded bg-[#f0f0f0]" />
                <div className="h-3 w-44 rounded bg-[#f4f4f4] mt-2" />
                <div className="h-12 rounded-2xl bg-[#f6f6f6] mt-4" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white border border-[#e0e0e0] rounded-3xl py-16 text-center">
            <ClipboardCheck className="h-10 w-10 text-[#e0e0e0] mx-auto" />
            <p className="text-sm font-black mt-3">Tidak ada item di tahap ini</p>
            <p className="text-xs text-slate-400 mt-1">
              {tab === 'frontliner'
                ? (pickup === 'delivery'
                  ? 'Belum ada nota antar-jemput. Klik "Semua" untuk melihat seluruh nota.'
                  : 'Nota baru akan muncul di sini setelah checkout.')
                : 'Belum ada item siap diantar. Item masuk ke sini setelah lolos packing.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((txn) => {
              const items = visibleItems(txn);
              const lunas = String(txn.payment_status || '').toLowerCase() === 'lunas';
              const isPickup = items.some((it) => it.fulfillment_type === 'Delivery_Kurir');
              return (
                <div key={txn.id} className="bg-white border border-[#e0e0e0] rounded-3xl p-4 sm:p-5 flex flex-col gap-4 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-sm text-[#5f1340] truncate">{txn.order_no}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{txn.customer_name}</p>
                      {txn.customer_phone && <p className="text-[11px] text-slate-400 mt-0.5">{txn.customer_phone}</p>}
                      <span className={`inline-flex items-center gap-1 mt-2 text-[10px] font-black px-2.5 py-1 rounded-lg border ${isPickup ? 'bg-[#5f1340]/5 text-[#5f1340] border-[#5f1340]/20' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {isPickup ? <Truck className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                        {isPickup ? 'Antar-Jemput' : 'Ambil di Outlet'}
                      </span>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border shrink-0 ${lunas ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {txn.payment_status}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {items.map((item) => {
                      const held = Number(item.is_on_hold) === 1;
                      const finding = Number(item.has_finding) === 1;
                      const stage = stageFor(tab, item);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={held}
                          onClick={() => setTarget({ txn, item, stage })}
                          className={`w-full text-left rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 transition disabled:opacity-60 disabled:cursor-not-allowed ${
                            held
                              ? 'bg-amber-50 border-amber-200'
                              : finding
                                ? 'bg-red-50 border-red-200 hover:border-red-400'
                                : 'bg-[#fafafa] border-[#e0e0e0] hover:border-[#5f1340]'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-black truncate">{item.service_name}</span>
                            <span className="block text-[11px] text-slate-500 mt-0.5">
                              {Number(item.qty)} {item.unit} · {item.item_work_status}{held ? ' · HOLD' : ''}
                            </span>
                          </span>
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl shrink-0 ${held ? 'bg-amber-200/70 text-amber-800' : 'bg-[#5f1340] text-white'}`}>
                            {held ? 'HOLD' : stage === 'handover' ? 'Selesai' : 'QC'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {scanOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-[#e0e0e0] w-full max-w-md max-h-[100dvh] overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <div className="px-4 py-3 border-b border-[#e0e0e0] flex items-center justify-between">
              <p className="text-sm font-black">Scan barcode / QR nota</p>
              <button type="button" onClick={stopScanner} className="w-8 h-8 rounded-xl border border-[#e0e0e0] grid place-items-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              {scanError && <p className="mb-2 text-xs font-bold text-red-600">{scanError}</p>}
              <div id={QC_SCANNER_ID} className="w-full overflow-hidden rounded-2xl bg-black min-h-[220px] max-h-[60dvh]" />
            </div>
          </div>
        </div>
      )}

      {target && (
        <QcSheet
          target={target}
          onClose={() => setTarget(null)}
          onSaved={(message) => { setTarget(null); setNotice(message); load(); }}
        />
      )}

      {photoPreview && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4" onClick={() => setPhotoPreview(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-[#e0e0e0] w-full max-w-lg max-h-[100dvh] overflow-hidden pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-[#e0e0e0] flex items-center justify-between">
              <p className="text-sm font-black truncate pr-3">{photoPreview.title}</p>
              <button type="button" onClick={() => setPhotoPreview(null)} aria-label="Tutup preview" className="w-8 h-8 rounded-xl border border-[#e0e0e0] grid place-items-center shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              <img src={photoPreview.url} alt={photoPreview.title} className="w-full h-auto max-h-[72vh] object-contain rounded-2xl bg-[#f8f8f8]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
