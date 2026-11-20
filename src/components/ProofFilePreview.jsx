import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Maximize2 } from 'lucide-react';

/**
 * Pratinjau file bukti bayar yang baru dipilih (sebelum diunggah).
 * Foto: thumbnail, klik untuk lihat besar. PDF: ikon, klik untuk buka di tab baru.
 */
export default function ProofFilePreview({ file, onRemove }) {
  const [url, setUrl] = useState('');
  const [zoom, setZoom] = useState(false);
  const isPdf = file?.type === 'application/pdf';

  useEffect(() => {
    if (!file) return undefined;
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  useEffect(() => {
    if (!zoom) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setZoom(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  if (!file || !url) return null;

  const open = () => {
    if (isPdf) window.open(url, '_blank', 'noopener');
    else setZoom(true);
  };

  return (
    <>
      <div className="mt-2 flex items-center gap-3 p-2 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl">
        <button
          type="button"
          onClick={open}
          title={isPdf ? 'Buka PDF' : 'Lihat foto'}
          className="relative group shrink-0 h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden border border-[#e0e0e0] bg-white cursor-pointer"
        >
          {isPdf ? (
            <span className="h-full w-full flex flex-col items-center justify-center text-rose-600">
              <FileText className="h-6 w-6" />
              <span className="text-[9px] font-black mt-0.5">PDF</span>
            </span>
          ) : (
            <>
              <img src={url} alt="Pratinjau bukti bayar" className="h-full w-full object-cover" />
              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                <Maximize2 className="h-4 w-4 text-white opacity-0 group-hover:opacity-100" />
              </span>
            </>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-600 truncate">{file.name || 'Bukti bayar terpilih'}</p>
          <button type="button" onClick={open} className="text-[11px] font-black text-[#5f1340] hover:underline cursor-pointer">
            {isPdf ? 'Buka PDF' : 'Lihat besar'}
          </button>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[10px] font-bold text-rose-600 flex items-center gap-1 cursor-pointer shrink-0 px-2 py-1"
          >
            <X className="h-3 w-3" /> Hapus
          </button>
        )}
      </div>

      {zoom && !isPdf && createPortal(
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoom(false)}
        >
          <div className="relative max-w-[min(94vw,720px)] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img src={url} alt="Bukti bayar" className="max-w-full max-h-[90vh] rounded-xl object-contain bg-white" />
            <button
              type="button"
              onClick={() => setZoom(false)}
              aria-label="Tutup"
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white grid place-items-center cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
