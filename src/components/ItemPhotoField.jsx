import React, { useState } from 'react';
import axios from 'axios';
import { Camera, Image, Loader2, Upload } from 'lucide-react';
import QcCameraModal from './QcCameraModal.jsx';
import ImageLightbox from './ImageLightbox.jsx';
import { buildQcPhotoLines, burnQcPhoto } from '../utils/qcPhotoStamp.js';
import { useAppDialog } from '../context/AppDialogContext.jsx';

// Detail noda/kondisi harus tetap terbaca → kompresi minimal
const ITEM_PHOTO_MAX_EDGE = 2560;
const ITEM_PHOTO_QUALITY = 0.95;

/**
 * Foto fisik item cucian saat diterima (bukan foto QC).
 * Dipakai di Keranjang (sebelum nota jadi) dan Detail Riwayat (nota sudah jadi).
 *
 * - uploadUrl: endpoint POST multipart (field "photo") → { data: { photoUrl } }
 * - onUploaded(url): dipanggil setelah upload sukses
 */
export default function ItemPhotoField({ photoUrl, uploadUrl, orderLabel = 'Item', onUploaded, size = 120, compact = false }) {
  const { showAlert } = useAppDialog();
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const send = async (file) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await axios.post(uploadUrl, fd, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const url = res.data?.data?.photoUrl;
      if (!url) throw new Error('URL foto tidak diterima');
      onUploaded?.(url);
    } catch (err) {
      showAlert({
        title: 'Gagal Upload Foto',
        message: err.response?.data?.message || err.message || 'Foto item tidak bisa diunggah',
        type: 'error'
      });
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      showAlert({ title: 'File Tidak Didukung', message: 'Gunakan foto JPG, PNG, atau WEBP.', type: 'warning' });
      return;
    }
    try {
      await send(await burnQcPhoto(file, { orderNo: orderLabel, stage: 'item_photo', maxEdge: ITEM_PHOTO_MAX_EDGE, quality: ITEM_PHOTO_QUALITY }));
    } catch {
      showAlert({ title: 'Gagal Memproses Foto', message: 'Foto tidak bisa diproses.', type: 'error' });
    }
  };

  const btn = 'inline-flex items-center justify-center gap-1 rounded-lg border border-[#e0e0e0] bg-white hover:border-[#5f1340]/50 text-[10px] font-black text-slate-600 px-2 py-1.5 cursor-pointer disabled:opacity-50';

  return (
    <div className={compact ? 'flex items-center gap-2' : 'shrink-0'} style={compact ? undefined : { width: size }}>
      {photoUrl ? (
        <button
          type="button"
          title="Lihat foto"
          onClick={(e) => { e.stopPropagation(); setPreviewOpen(true); }}
          className="block p-0 border-0 bg-transparent cursor-zoom-in"
        >
          <img
            src={photoUrl}
            alt="Foto item"
            style={{ width: compact ? 40 : '100%', height: compact ? 40 : size }}
            className="object-cover rounded-xl border border-[#e0e0e0]"
          />
        </button>
      ) : !compact && (
        <div
          style={{ width: '100%', height: size }}
          className="rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-1 text-slate-400"
        >
          <Image className="h-5 w-5" />
          <span className="text-[10px] font-bold">Tidak ada foto</span>
        </div>
      )}

      <div className={compact ? 'flex gap-1.5' : 'grid grid-cols-2 gap-1.5 mt-1.5'} onClick={(e) => e.stopPropagation()}>
        <button type="button" disabled={busy} onClick={() => setCameraOpen(true)} className={btn} title={photoUrl ? 'Ganti foto (kamera)' : 'Ambil foto (kamera)'}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          {!compact && <span>{photoUrl ? 'Ganti' : 'Kamera'}</span>}
        </button>
        <label className={`${btn} ${busy ? 'opacity-50 pointer-events-none' : ''}`} title="Pilih file foto">
          <Upload className="h-3 w-3" />
          {!compact && <span>File</span>}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              e.target.value = '';
              pickFile(file);
            }}
          />
        </label>
      </div>

      {previewOpen && (
        <ImageLightbox src={photoUrl} alt="Foto item" title={`Foto Item — ${orderLabel}`} onClose={() => setPreviewOpen(false)} />
      )}

      <QcCameraModal
        open={cameraOpen}
        title="Ambil Foto Item"
        buildOverlayLines={(date) => buildQcPhotoLines({ orderNo: orderLabel, stage: 'item_photo', date })}
        jpegQuality={ITEM_PHOTO_QUALITY}
        onCapture={(file) => {
          setCameraOpen(false);
          send(file);
        }}
        onClose={() => setCameraOpen(false)}
      />
    </div>
  );
}
