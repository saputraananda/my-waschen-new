import React, { useState } from 'react';
import { Upload, Camera, X } from 'lucide-react';
import QcCameraModal from './QcCameraModal.jsx';
import { buildQcPhotoLines, burnQcPhoto } from '../utils/qcPhotoStamp.js';
import { useAppDialog } from '../context/AppDialogContext.jsx';

const allowed = (file) => file?.type === 'application/pdf' || /^image\/(jpeg|png|webp)$/.test(file?.type || '');

/** Pilih file atau foto kamera untuk bukti bayar non-tunai. */
export default function PaymentProofFields({ orderNo = 'Bukti Bayar', file, onFile, label = 'Upload Bukti Pembayaran (Wajib)' }) {
  const { showAlert } = useAppDialog();
  const [open, setOpen] = useState(false);

  const accept = async (raw, stamped) => {
    if (!raw) return;
    if (!stamped && !allowed(raw)) {
      showAlert({
        title: 'File Tidak Didukung',
        message: 'Gunakan foto JPG, PNG, WEBP, atau PDF.',
        type: 'warning'
      });
      return;
    }
    try {
      onFile(stamped || raw.type === 'application/pdf'
        ? raw
        : await burnQcPhoto(raw, { orderNo, stage: 'payment' }));
    } catch {
      showAlert({ title: 'Foto tidak valid', message: 'Pilih foto jpeg, png, atau webp.', type: 'error' });
    }
  };

  return (
    <div>
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-[#e0e0e0] rounded-xl cursor-pointer hover:border-[#5f1340]/40">
          <Upload className="h-4 w-4 text-slate-400 mb-1" />
          <span className="text-[10px] font-bold text-slate-500 text-center">Pilih file foto/PDF</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const next = e.target.files?.[0] || null;
              e.target.value = '';
              accept(next, false);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-[#e0e0e0] rounded-xl cursor-pointer hover:border-[#5f1340]/40"
        >
          <Camera className="h-4 w-4 text-slate-400 mb-1" />
          <span className="text-[10px] font-bold text-slate-500 text-center">Ambil foto kamera</span>
        </button>
      </div>
      {file && (
        <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl">
          <span className="text-[11px] font-bold text-slate-600 truncate">{file.name || 'Bukti bayar terpilih'}</span>
          <button type="button" onClick={() => onFile(null)} className="text-[10px] font-bold text-rose-600 flex items-center gap-1 cursor-pointer shrink-0">
            <X className="h-3 w-3" /> Hapus
          </button>
        </div>
      )}
      <QcCameraModal
        open={open}
        title="Ambil Foto Bukti Bayar"
        buildOverlayLines={(date) => buildQcPhotoLines({ orderNo, stage: 'payment', date })}
        onCapture={(next) => { setOpen(false); accept(next, true); }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
