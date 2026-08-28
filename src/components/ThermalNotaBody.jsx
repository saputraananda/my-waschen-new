import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { buildNotaModel, NOTA_DASH } from '../utils/notaModel.js';

/**
 * Preview = sumber kebenaran layout (QR kiri besar + teks kanan).
 * Cetak mengikuti layout yang sama via raster header.
 */
export default function ThermalNotaBody({
  receipt,
  settings,
  variant = 'customer',
  compact = false
}) {
  if (!receipt || !settings) return null;

  const rows = buildNotaModel(receipt, settings, variant);
  const pad = compact ? 'px-2 py-2.5' : 'px-2.5 py-3 sm:px-3 sm:py-4';

  return (
    <div className="w-full max-w-[300px] mx-auto min-w-0">
      <div
        className={`w-full min-w-0 bg-[#fffefb] shadow-sm border border-slate-200/80 ${pad} font-mono text-[9px] sm:text-[10px] leading-[1.35] text-slate-800`}
      >
        <div className="space-y-0 min-w-0">
          {rows.map((row, idx) => {
            if (row.type === 'blank') {
              return <div key={idx} className="h-1.5 sm:h-2" />;
            }

            if (row.type === 'dash') {
              return (
                <p key={idx} className="whitespace-pre overflow-hidden text-ellipsis">
                  {NOTA_DASH}
                </p>
              );
            }

            if (row.type === 'header') {
              return (
                <div key={idx} className="flex gap-1.5 items-start mb-1.5 min-w-0">
                  {row.qr && (
                    <div className="shrink-0 bg-white leading-none">
                      <QRCodeSVG
                        value={row.qr}
                        size={168}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 pt-0.5 space-y-0.5">
                    {(row.lines || []).map((l, i) => (
                      <p
                        key={i}
                        className={`break-words ${i === 0 ? 'font-bold text-[10px] sm:text-[11px]' : 'text-[8px] sm:text-[9px]'}`}
                      >
                        {l}
                      </p>
                    ))}
                  </div>
                </div>
              );
            }

            const align =
              row.align === 'center'
                ? 'text-center'
                : row.align === 'right'
                  ? 'text-right'
                  : 'text-left';
            const weight = row.bold ? 'font-bold' : 'font-normal';
            const size = row.size === 'huge'
              ? 'text-[18px] sm:text-[22px] leading-none font-black tracking-tight break-all py-1'
              : row.size === 'tall'
                ? 'text-[12px] sm:text-[13px] leading-tight font-black tracking-tight break-all'
                : 'text-[9px] sm:text-[10px] break-words';

            return (
              <p
                key={idx}
                className={`min-w-0 ${align} ${weight} ${size}`}
              >
                {row.text || ' '}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
