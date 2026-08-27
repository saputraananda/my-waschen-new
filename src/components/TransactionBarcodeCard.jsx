import React, { useState } from 'react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Copy, Check, ExternalLink, Printer } from 'lucide-react';

export default function TransactionBarcodeCard({
  orderNo = 'WLRH202608250001',
  barcodeValue = null,
  onPrint = null,
  onTrack = null,
  compact = false,
  className = ''
}) {
  const [copied, setCopied] = useState(false);
  const codeToRender = barcodeValue || orderNo || 'WLRH202608250001';
  const trackingUrl = `${window.location.origin}/dashboard?trackingNo=${encodeURIComponent(orderNo)}`;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(codeToRender);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <div className={`p-2 bg-white border border-[#e0e0e0] rounded-xl flex items-center justify-between gap-3 shadow-2xs ${className}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="bg-slate-100 p-1 rounded border border-slate-200 shrink-0">
            <QRCodeSVG value={trackingUrl} size={36} level="M" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Barcode Nota</span>
            <span className="font-mono font-black text-xs text-[#313030] truncate block">{codeToRender}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
          title="Salin Nomor Barcode"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Tersalin' : 'Salin'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-slate-50 via-white to-pink-50/20 border border-[#e0e0e0] rounded-2xl p-4 shadow-2xs ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#5f1340]/10 text-[#5f1340] rounded-lg">
            <QrCode className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-[#313030]">Barcode & QR Tracking Transaksi</h4>
            <p className="text-[10px] text-slate-400">Pindai barcode untuk verifikasi & lacak nota real-time</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
          <span>{copied ? 'Tersalin!' : 'Salin Kode'}</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 bg-white p-3 rounded-xl border border-slate-200/80">
        {/* 1D Barcode (Code128) */}
        <div className="flex flex-col items-center justify-center">
          <div className="overflow-x-auto max-w-full">
            <Barcode
              value={codeToRender}
              format="CODE128"
              width={1.4}
              height={45}
              fontSize={11}
              margin={4}
              background="#ffffff"
              lineColor="#1e293b"
            />
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Format: Code128 POS Scanner
          </span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-16 bg-slate-200" />

        {/* 2D QR Code */}
        <div className="flex flex-col items-center justify-center">
          <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <QRCodeSVG value={trackingUrl} size={90} level="M" includeMargin={false} />
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            QR Tracking Digital
          </span>
        </div>
      </div>

      {(onPrint || onTrack) && (
        <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-100">
          {onTrack && (
            <button
              type="button"
              onClick={onTrack}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Buka Tracking</span>
            </button>
          )}
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="px-3 py-1.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white text-[11px] font-black rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Cetak Nota & Barcode</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
