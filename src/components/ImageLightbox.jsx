import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Pengganti <a target="_blank"> untuk bukti/lampiran: gambar → lightbox, PDF → tab baru
 * (PDF tidak bisa ditampilkan sebagai gambar).
 */
export function ProofLink({ url, title, className, children }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  if (/\.pdf(\?|$)/i.test(String(url))) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className} title={title}>
        {children}
      </a>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} title={title}>
        {children}
      </button>
      {open && <ImageLightbox src={url} alt={title} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Pratinjau gambar dalam modal (bukan tab baru). Portal ke body supaya tidak
 * terpotong modal induk; Esc / klik latar untuk menutup.
 */
export default function ImageLightbox({ src, alt = 'Gambar', title, onClose }) {
  useEffect(() => {
    if (!src) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [src, onClose]);

  if (!src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] bg-[#313030]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative max-w-5xl w-full max-h-full flex flex-col items-center gap-2">
        <div className="w-full flex items-center justify-between gap-3 text-white">
          <span className="text-sm font-black truncate">{title || alt}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 grid place-items-center shrink-0 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[82vh] object-contain rounded-2xl bg-white shadow-2xl"
        />
      </div>
    </div>,
    document.body
  );
}
