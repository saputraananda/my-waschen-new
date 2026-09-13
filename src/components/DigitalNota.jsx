import React, { useMemo } from 'react';
import { getQrValue } from '../utils/notaLayout.js';
import { buildCustomerNotaModel } from '../utils/notaModel.js';
import { DEFAULT_CUSTOMER_SETTINGS } from '../utils/printerSettings.js';

/**
 * Satu sumber kalimat nota digital (WhatsApp / preview).
 * Ubah copy di sini saja — Complete / History / Dashboard consume lewat export di bawah.
 */

export const DIGITAL_NOTA_INTRO = (customerName) => (
  `Halo Kak ${customerName || 'Pelanggan'}, berikut nota digital Anda dari Waschen Laundry.`
);

export const DIGITAL_NOTA_QR_HINT =
  '📷 QR nota terlampir (atau scan lewat link di bawah).';

export const DIGITAL_NOTA_FOOTER =
  'Simpan pesan ini sebagai bukti pengambilan ya. Terima kasih 🙏';

function modelRowsToWhatsAppText(rows) {
  const lines = [];
  for (const row of rows || []) {
    if (!row) continue;
    if (row.type === 'dash') {
      lines.push('────────');
      continue;
    }
    if (row.type === 'header') {
      for (const line of row.lines || []) {
        if (line != null && String(line).trim()) lines.push(String(line));
      }
      continue;
    }
    if (row.type === 'text') {
      const text = String(row.text ?? '');
      if (!text) continue;
      lines.push(row.bold ? `*${text}*` : text);
    }
  }
  return lines.join('\n');
}

/**
 * Isi body = mirror cetak Nota Customer (printer settings).
 */
export function buildDigitalNotaBody(receipt, settings = DEFAULT_CUSTOMER_SETTINGS) {
  return modelRowsToWhatsAppText(buildCustomerNotaModel(receipt, settings));
}

/**
 * Teks lengkap yang di-prefill ke chat WhatsApp.
 */
export function buildDigitalNotaMessage(receipt, settings = DEFAULT_CUSTOMER_SETTINGS) {
  const name = receipt?.customerName || 'Pelanggan';
  const qrValue = getQrValue(receipt);
  const body = buildDigitalNotaBody(receipt, settings);

  return [
    DIGITAL_NOTA_INTRO(name),
    '',
    body,
    '',
    DIGITAL_NOTA_QR_HINT,
    `Lacak status: ${qrValue}`,
    '',
    DIGITAL_NOTA_FOOTER
  ].join('\n');
}

/** @deprecated pakai buildDigitalNotaMessage */
export const buildCustomerNotaWhatsAppText = buildDigitalNotaMessage;

/**
 * Preview teks nota digital (opsional di UI).
 * Logika kirim WA tetap di utils/customerNotaWhatsApp.js → consume buildDigitalNotaMessage.
 */
export default function DigitalNota({
  receipt,
  settings = DEFAULT_CUSTOMER_SETTINGS,
  className = ''
}) {
  const message = useMemo(
    () => (receipt ? buildDigitalNotaMessage(receipt, settings) : ''),
    [receipt, settings]
  );

  if (!receipt) return null;

  return (
    <div
      className={`rounded-2xl border border-[#e0e0e0] bg-[#fffefb] p-4 font-mono text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap ${className}`}
    >
      {message}
    </div>
  );
}
