import React, { useState } from 'react';
import axios from 'axios';
import { Camera, Image, Loader2, Upload, X } from 'lucide-react';
import QcCameraModal from './QcCameraModal.jsx';
import ImageLightbox from './ImageLightbox.jsx';
import { buildQcPhotoLines, burnQcPhoto } from '../utils/qcPhotoStamp.js';
import { useAppDialog } from '../context/AppDialogContext.jsx';

// Detail noda/kondisi harus tetap terbaca → kompresi minimal (sama dengan ItemPhotoField)
const ITEM_PHOTO_MAX_EDGE = 2560;
const ITEM_PHOTO_QUALITY = 0.95;
export const MAX_ITEM_PHOTOS = 10;

/**
 * Foto kondisi item saat diterima — opsional, boleh lebih dari 1.
 *
 * - photos: [{ id?, url }]
 * - uploadUrl: POST multipart (field "photo") → { data: { photoUrl, photos? } }
 * - onUploaded(url, responseData): setelah satu foto berhasil diunggah
 * - onRemove(photo): hapus satu foto (opsional; tanpa ini tombol hapus disembunyikan)
 * - required: tandai merah bila belum ada foto (default: tidak wajib)
 */
export default function ItemPhotosField({
  photos = [],
  uploadUrl,
  orderLabel = 'Item',
  onUploaded,
  onRemove,
  required = false,
  max = MAX_ITEM_PHOTOS
}) {
  const { showAlert } = useAppDialog();
  const [busy, setBusy] = useState(false);
  const [removingKey, setRemovingKey] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preview, setPreview] = useState(null);

  const count = photos.length;
  const full = count >= max;
  const missing = required && count === 0;

  const upload = async (file) => {
    const fd = new FormData();
    fd.append('photo', file);
    const res = await axios.post(uploadUrl, fd, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const url = res.data?.data?.photoUrl;
    if (!url) throw new Error('URL foto tidak diterima');
    onUploaded?.(url, res.data?.data);
  };

  const sendFiles = async (files) => {
    const list = files.filter(Boolean).slice(0, Math.max(0, max - count));
    if (!list.length) {
      if (files.length && full) showAlert({ title: 'Foto Penuh', message: `Maksimal ${max} foto per item.`, type: 'warning' });
      return;
    }
    setBusy(true);
    try {
      for (const file of list) {
        await upload(file);
      }
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

  const pickFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const bad = files.filter((f) => !/^image\/(jpeg|png|webp)$/.test(f.type));
    if (bad.length) {
      showAlert({ title: 'File Tidak Didukung', message: 'Gunakan foto JPG, PNG, atau WEBP.', type: 'warning' });
      return;
    }
    try {
      const stamped = [];
      for (const f of files) {
        stamped.push(await burnQcPhoto(f, { orderNo: orderLabel, stage: 'item_photo', maxEdge: ITEM_PHOTO_MAX_EDGE, quality: ITEM_PHOTO_QUALITY }));
      }
      await sendFiles(stamped);
    } catch {
      showAlert({ title: 'Gagal Memproses Foto', message: 'Foto tidak bisa diproses.', type: 'error' });
    }
  };

  const remove = async (photo, key) => {
    if (!onRemove || removingKey) return;
    setRemovingKey(key);
    try {
      await onRemove(photo);
    } catch (err) {
      showAlert({
        title: 'Gagal Menghapus Foto',
        message: err.response?.data?.message || err.message || 'Foto tidak bisa dihapus',
        type: 'error'
      });
    } finally {
      setRemovingKey(null);
    }
  };

  const bigBtn = 'inline-flex items-center justify-center gap-2 rounded-xl border text-xs font-black px-3 py-2.5 cursor-pointer disabled:opacity-50 min-w-0 transition-colors';
  const btnTone = missing
    ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
    : 'border-[#5f1340]/25 bg-white text-[#5f1340] hover:bg-[#5f1340]/5 hover:border-[#5f1340]/50';

  return (
    <div className="flex flex-col gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-black uppercase tracking-wider ${missing ? 'text-rose-600' : 'text-slate-500'}`}>
          Foto Item {required && <span className="text-rose-500">*</span>}
        </span>
        <span className={`text-[10px] font-bold ${missing ? 'text-rose-600' : 'text-slate-400'}`}>
          {missing ? 'Wajib minimal 1 foto' : count ? `${count} foto${full ? ' (maks.)' : ''}` : 'Belum ada foto'}
        </span>
      </div>

      {count > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
          {photos.map((p, i) => {
            const key = p.id ?? p.url ?? i;
            return (
              <div key={key} className="relative shrink-0">
                <button
                  type="button"
                  title={`Lihat foto ${i + 1}`}
                  onClick={() => setPreview({ url: p.url, index: i })}
                  className="block p-0 border-0 bg-transparent cursor-zoom-in"
                >
                  <img src={p.url} alt={`Foto item ${i + 1}`} className="h-14 w-14 object-cover rounded-xl border border-[#e0e0e0]" />
                </button>
                {onRemove && (
                  <button
                    type="button"
                    title="Hapus foto"
                    disabled={removingKey != null}
                    onClick={() => remove(p, key)}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-500 hover:text-rose-600 hover:border-rose-300 cursor-pointer disabled:opacity-50"
                  >
                    {removingKey === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!full && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => setCameraOpen(true)} className={`${bigBtn} ${btnTone}`}>
            {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : (count ? <Camera className="h-4 w-4 shrink-0" /> : <Image className="h-4 w-4 shrink-0" />)}
            <span className="truncate">{count ? 'Tambah Foto' : 'Ambil Foto'}</span>
          </button>
          <label className={`${bigBtn} ${btnTone} ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">Galeri</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                pickFiles(files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}

      {preview && (
        <ImageLightbox
          src={preview.url}
          alt="Foto item"
          title={`Foto Item ${preview.index + 1}/${count} — ${orderLabel}`}
          onClose={() => setPreview(null)}
        />
      )}

      <QcCameraModal
        open={cameraOpen}
        title="Ambil Foto Item"
        buildOverlayLines={(date) => buildQcPhotoLines({ orderNo: orderLabel, stage: 'item_photo', date })}
        jpegQuality={ITEM_PHOTO_QUALITY}
        onCapture={(file) => {
          setCameraOpen(false);
          sendFiles([file]);
        }}
        onClose={() => setCameraOpen(false)}
      />
    </div>
  );
}
