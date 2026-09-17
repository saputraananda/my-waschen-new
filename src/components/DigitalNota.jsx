import React, { useMemo } from 'react';
import { buildCustomerTrackingUrl } from '../utils/customerTrackingUrl.js';
import { DEFAULT_CUSTOMER_SETTINGS } from '../utils/printerSettings.js';

/**
 * Satu sumber kalimat nota digital (WhatsApp / preview).
 * Simpel: greeting → rincian → link tracking + kode akses → terima kasih.
 * Tidak mengirim gambar nota / gambar barcode.
 */

function formatRp(n) {
  return `Rp${Number(n || 0).toLocaleString('id-ID')}`;
}

function paymentLabel(receipt) {
  const ps = receipt?.paymentStatus || 'Outstanding';
  if (ps === 'Lunas') return 'Lunas';
  if (ps === 'DP') return `DP (${formatRp(receipt?.paidAmount)})`;
  return 'Belum Lunas';
}

function itemLine(it) {
  const name = it?.name || it?.serviceName || 'Layanan';
  const qty = it?.qtyDisplay || (it?.qty != null ? String(it.qty) : '1');
  const sub = Number(it?.effectiveSubtotal ?? it?.subtotal) || 0;
  return `  ・ ${qty} ${name}${sub ? ` — ${formatRp(sub)}` : ''}`;
}

export const DIGITAL_NOTA_INTRO = (customerName) => (
  `Halo Kak ${customerName || 'Pelanggan'} 👋\n`
  + 'Terima kasih telah menggunakan jasa Waschen Laundry.'
);

export const DIGITAL_NOTA_FOOTER =
  'Nikmati hasil cucian yang bersih, rapi, wangi, dan higienis melalui layanan premium Waschen. 🤍';

/**
 * Ringkasan rincian pesanan untuk chat WA (bukan mirror struk thermal penuh).
 */
export function buildDigitalNotaBody(receipt) {
  if (!receipt) return '';
  const lines = [];
  const orderNo = receipt.id || receipt.orderNo || '';
  lines.push('*Rincian pesanan Anda*');
  if (orderNo) lines.push(`Nota: *${orderNo}*`);
  if (receipt.branch) lines.push(`Outlet : ${receipt.branch}`);
  if (receipt.perfume) lines.push(`Parfum: ${receipt.perfume}`);
  lines.push('');

  const items = Array.isArray(receipt.items) ? receipt.items : [];
  if (items.length) {
    items.forEach((it) => lines.push(itemLine(it)));
  } else {
    lines.push(`  ・ ${receipt.serviceType || receipt.category || 'Layanan Laundry'}`);
  }

  lines.push('');
  lines.push(`Total: *${formatRp(receipt.grandTotal)}*`);
  lines.push(`Status Pembayaran: *${paymentLabel(receipt)}*`);
  return lines.join('\n');
}

/**
 * Teks lengkap yang di-prefill ke chat WhatsApp.
 * Wajib punya trackingUrl + accessCode yang valid dari server.
 */
export function buildDigitalNotaMessage(receipt, _settings = DEFAULT_CUSTOMER_SETTINGS) {
  const name = receipt?.customerName || 'Pelanggan';
  const orderNo = receipt?.id || receipt?.orderNo || '';
  const trackingUrl = String(receipt?.trackingUrl || buildCustomerTrackingUrl(orderNo) || '').trim();
  const accessCode = String(receipt?.accessCode || '').replace(/\D/g, '');

  if (!orderNo) {
    return 'Nomor nota tidak valid. Hubungi kasir Waschen.';
  }
  if (!trackingUrl || !/^https?:\/\//i.test(trackingUrl)) {
    return [
      DIGITAL_NOTA_INTRO(name),
      '',
      buildDigitalNotaBody(receipt),
      '',
      'PERHATIAN: Link tracking belum tersedia. Mohon hubungi kasir Waschen untuk mengirim ulang nota digital.',
      '',
      DIGITAL_NOTA_FOOTER
    ].join('\n');
  }
  if (!/^\d{4}$/.test(accessCode)) {
    return [
      DIGITAL_NOTA_INTRO(name),
      '',
      buildDigitalNotaBody(receipt),
      '',
      'PERHATIAN: Kode akses belum siap. Mohon hubungi kasir Waschen untuk mengirim ulang nota digital.',
      '',
      DIGITAL_NOTA_FOOTER
    ].join('\n');
  }

  return [
    DIGITAL_NOTA_INTRO(name),
    '',
    buildDigitalNotaBody(receipt),
    '',
    '📦 *Lacak progres cucian :*',
    trackingUrl,
    `Kode akses: *${accessCode}*`,
    '',
    DIGITAL_NOTA_FOOTER
  ].join('\n');
}

/** @deprecated pakai buildDigitalNotaMessage */
export const buildCustomerNotaWhatsAppText = buildDigitalNotaMessage;

/**
 * Preview teks nota digital (opsional di UI).
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
