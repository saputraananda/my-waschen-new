import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Copy, Check, ExternalLink, Printer } from 'lucide-react';

/**
 * variant:
 * - "card" (default): panel QR standalone
 * - "aside": panel samping (detail nota) — QR kiri, info kanan
 * - "compact": strip kecil
 */
export default function TransactionBarcodeCard({
  orderNo = 'WLRH202608250001',
  barcodeValue = null,
  onPrint = null,
  onTrack = null,
  compact = false,
  variant = 'card',
  className = '',
  meta = null
}) {
  const [copied, setCopied] = useState(false);
  const codeToRender = barcodeValue || orderNo || 'WLRH202608250001';
  const trackingUrl = `${window.location.origin}/dashboard?trackingNo=${encodeURIComponent(orderNo)}`;
  const layout = compact ? 'compact' : variant;

  const handleCopy = (e) => {
    e?.stopPropagation?.();
    navigator.clipboard.writeText(codeToRender);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (layout === 'compact') {
    return (
      <div className={`p-2 bg-white border border-[#e0e0e0] rounded-xl flex items-center justify-between gap-3 shadow-2xs ${className}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="bg-slate-100 p-1 rounded border border-slate-200 shrink-0">
            <QRCodeSVG value={trackingUrl} size={36} level="M" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">QR Nota</span>
            <span className="font-mono font-black text-xs text-[#313030] truncate block">{codeToRender}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
          title="Salin Nomor Nota"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Tersalin' : 'Salin'}</span>
        </button>
      </div>
    );
  }

  if (layout === 'aside') {
    return (
      <div className={`bg-gradient-to-br from-[#5f1340]/[0.04] via-white to-slate-50 border border-[#e0e0e0] rounded-2xl p-3.5 sm:p-4 shadow-2xs ${className}`}>
        <div className="flex items-start gap-3.5">
          <div className="shrink-0 p-2 bg-white rounded-xl border border-[#e0e0e0] shadow-2xs">
            <QRCodeSVG value={trackingUrl} size={96} level="M" includeMargin={false} />
          </div>

          <div className="min-w-0 flex-1 flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <div className="p-1.5 bg-[#5f1340]/10 text-[#5f1340] rounded-lg shrink-0">
                <QrCode className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-[#313030] leading-tight">QR Tracking</h4>
                <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                  Scan untuk lacak status nota
                </p>
              </div>
            </div>

            <div className="bg-white/80 border border-[#e0e0e0] rounded-xl px-2.5 py-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">No. Nota</span>
              <span className="font-mono font-black text-[11px] text-[#313030] break-all">{codeToRender}</span>
            </div>

            {meta && (
              <div className="text-[10px] text-slate-500 space-y-0.5">
                {meta.statusLabel && (
                  <p>
                    Status:{' '}
                    <span className={`font-extrabold ${meta.statusClass || 'text-[#313030]'}`}>
                      {meta.statusLabel}
                    </span>
                  </p>
                )}
                {meta.progressLabel && (
                  <p>
                    Progress:{' '}
                    <span className="font-extrabold text-[#5f1340]">{meta.progressLabel}</span>
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 mt-auto">
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-[#e0e0e0] text-slate-700 text-[10px] font-extrabold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Tersalin' : 'Salin'}</span>
              </button>
              {onTrack && (
                <button
                  type="button"
                  onClick={onTrack}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Lacak</span>
                </button>
              )}
              {onPrint && (
                <button
                  type="button"
                  onClick={onPrint}
                  className="px-2.5 py-1.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white text-[10px] font-black rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="h-3 w-3" />
                  <span>Cetak</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default card — horizontal composition (QR + info), bukan QR sendirian di tengah
  return (
    <div className={`bg-gradient-to-br from-slate-50 via-white to-pink-50/20 border border-[#e0e0e0] rounded-2xl p-4 shadow-2xs ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="shrink-0 mx-auto sm:mx-0 p-2.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <QRCodeSVG value={trackingUrl} size={108} level="M" includeMargin={false} />
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-[#5f1340]/10 text-[#5f1340] rounded-lg shrink-0">
                <QrCode className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black text-[#313030]">QR Tracking Transaksi</h4>
                <p className="text-[10px] text-slate-400">Pindai QR untuk verifikasi & lacak nota</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl px-3 py-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">No. Nota</span>
            <span className="font-mono font-black text-sm text-[#313030] break-all">{codeToRender}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold rounded-lg text-[10px] transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
              <span>{copied ? 'Tersalin!' : 'Salin Kode'}</span>
            </button>
            {onTrack && (
              <button
                type="button"
                onClick={onTrack}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Buka Tracking</span>
              </button>
            )}
            {onPrint && (
              <button
                type="button"
                onClick={onPrint}
                className="px-3 py-1.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white text-[11px] font-black rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak Nota</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
