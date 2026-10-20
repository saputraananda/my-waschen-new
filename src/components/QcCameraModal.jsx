import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, Loader2, Camera, CameraOff } from 'lucide-react';
import { drawTextOverlay } from '../utils/qcPhotoStamp.js';

/**
 * Kamera QC POS — struktur & watermark sama dengan CameraCaptureModal Waschen Mobile.
 * buildOverlayLines: (date: Date) => string[]
 */
export default function QcCameraModal({ open, title = 'Ambil Foto QC', buildOverlayLines, onCapture, onClose, jpegQuality = 0.88, maxEdge = 0 }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [videoReady, setVideoReady] = useState(false);
  const [camError, setCamError] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [now, setNow] = useState(new Date());

  const overlayLines = buildOverlayLines ? buildOverlayLines(now) : [];

  useEffect(() => {
    if (!open) return undefined;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setVideoReady(false);
  }, []);

  useEffect(() => {
    if (!open) { stopStream(); return undefined; }
    setCamError(null);
    setVideoReady(false);
    let cancelled = false;

    const getStream = (c) => navigator.mediaDevices.getUserMedia({ video: c, audio: false });
    (async () => {
      try {
        let stream;
        try { stream = await getStream({ facingMode }); }
        catch {
          try { stream = await getStream({ facingMode: { ideal: facingMode } }); }
          catch { stream = await getStream(true); }
        }
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => { if (!cancelled) setVideoReady(true); }).catch(() => {});
        }
      } catch (e) {
        if (!cancelled) {
          setCamError(e?.name === 'NotAllowedError' ? 'Izin kamera ditolak.' : 'Kamera tidak tersedia.');
        }
      }
    })();

    return () => { cancelled = true; stopStream(); };
  }, [open, facingMode, stopStream]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || capturing) return;
    setCapturing(true);

    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    const scale = maxEdge > 0 && srcW > maxEdge ? maxEdge / srcW : 1;
    const w = Math.round(srcW * scale);
    const h = Math.round(srcH * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setCapturing(false); return; }

    // Jangan mirror hasil: preview saja yang di-mirror (kamera depan), file tetap orientasi asli.
    ctx.drawImage(video, 0, 0, w, h);

    drawTextOverlay(ctx, w, h, buildOverlayLines ? buildOverlayLines(new Date()) : []);

    canvas.toBlob((blob) => {
      setCapturing(false);
      if (!blob) return;
      onCapture(new File([blob], `qc_${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', jpegQuality);
  };

  if (!open) return null;

  // Portal ke body: modal induk yang punya transform/overflow-hidden tidak boleh memotong kamera
  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-[#313030]/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-lg max-h-[100dvh] sm:max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)] animate-fade-in">
        <div className="px-5 py-4 border-b border-[#e0e0e0] bg-[#f8f8f8] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-[#5f1340]/10 text-[#5f1340] rounded-xl shrink-0">
              <Camera className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-[#313030] truncate">{title}</p>
              <p className="text-[11px] text-slate-400">Waktu & nomor nota tercetak otomatis di foto</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-[#313030] hover:bg-slate-200/60 grid place-items-center shrink-0 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {camError ? (
            <div className="rounded-2xl bg-[#313030] aspect-[3/4] sm:aspect-[4/3] flex items-center justify-center px-6 text-center">
              <div>
                <CameraOff className="h-8 w-8 text-white/40 mx-auto mb-2" />
                <p className="text-rose-300 text-xs font-black mb-1">Kamera Tidak Tersedia</p>
                <p className="text-white/60 text-[11px]">{camError}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden bg-black relative aspect-[3/4] sm:aspect-[4/3] max-h-[60dvh] mx-auto ring-1 ring-black/5">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
                style={facingMode === 'user' ? { transform: 'scaleX(-1)' } : undefined}
              />
              <button
                type="button"
                onClick={() => setFacingMode((p) => (p === 'user' ? 'environment' : 'user'))}
                aria-label="Ganti kamera"
                title="Ganti kamera depan/belakang"
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm grid place-items-center text-white cursor-pointer transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>

              {videoReady && overlayLines.length > 0 && (
                <div className="absolute left-3 bottom-3 text-white px-2.5 py-2 rounded-xl max-w-[calc(100%-24px)]" style={{ background: 'rgba(0,0,0,0.58)' }}>
                  {overlayLines.map((line, i) => (
                    <div key={i} className={`leading-snug ${i === 0 ? 'text-[11px] font-extrabold' : 'text-[10px] font-semibold text-white/95'}`}>{line}</div>
                  ))}
                </div>
              )}

              {!videoReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
            </div>
          )}

          {!videoReady && !camError && (
            <p className="mt-2 text-[11px] font-bold text-slate-500 text-center">Menyiapkan kamera…</p>
          )}
        </div>

        <div className="px-4 sm:px-5 py-3.5 border-t border-[#e0e0e0] bg-[#f8f8f8] grid grid-cols-[auto_1fr] gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 rounded-xl border border-[#e0e0e0] bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleCapture}
            disabled={!videoReady || !!camError || capturing}
            className="h-11 rounded-xl bg-[#5f1340] hover:bg-[#4d0f33] text-white text-xs font-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-[#5f1340]/20 cursor-pointer transition-colors"
          >
            {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <span>{capturing ? 'Memproses…' : 'Ambil Foto'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
