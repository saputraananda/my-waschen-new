import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, RefreshCw, Loader2 } from 'lucide-react';
import { drawTextOverlay } from '../utils/qcPhotoStamp.js';

/**
 * Kamera QC POS — struktur & watermark sama dengan CameraCaptureModal Waschen Mobile.
 * buildOverlayLines: (date: Date) => string[]
 */
export default function QcCameraModal({ open, title = 'Ambil Foto QC', buildOverlayLines, onCapture, onClose }) {
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

    const w = video.videoWidth;
    const h = video.videoHeight;
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
    }, 'image/jpeg', 0.88);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-md max-h-[100dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[#e0e0e0] shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <div className="px-4 py-3 border-b border-[#e0e0e0] flex items-center justify-between">
          <p className="text-sm font-black text-[#313030]">{title}</p>
          <button type="button" onClick={onClose} aria-label="Tutup" className="w-8 h-8 rounded-xl border border-[#e0e0e0] grid place-items-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3">
          {camError ? (
            <div className="rounded-2xl bg-[#313030] aspect-[3/4] flex items-center justify-center px-6 text-center">
              <div>
                <p className="text-red-400 text-xs font-black mb-1">Kamera Tidak Tersedia</p>
                <p className="text-white/60 text-[11px]">{camError}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden bg-black relative aspect-[3/4] max-h-[58dvh] mx-auto">
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
                className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/50 grid place-items-center text-white"
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

          {!videoReady && !camError && <p className="mt-2 text-[11px] font-bold text-slate-500">Menyiapkan kamera…</p>}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={onClose} className="h-11 rounded-2xl border border-[#e0e0e0] bg-white text-slate-700 text-xs font-black">Batal</button>
            <button
              type="button"
              onClick={handleCapture}
              disabled={!videoReady || !!camError || capturing}
              className="h-11 rounded-2xl bg-[#5f1340] text-white text-xs font-black disabled:opacity-50"
            >
              {capturing ? 'Memproses…' : 'Ambil Foto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
