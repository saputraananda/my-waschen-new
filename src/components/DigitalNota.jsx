import React, { useMemo } from 'react';
import { buildCustomerTrackingUrl } from '../utils/customerTrackingUrl.js';
import { DEFAULT_CUSTOMER_SETTINGS } from '../utils/printerSettings.js';
import { WIB_TZ, addWibDays, toWibDateKey } from '../utils/wib.js';

/**
 * Satu sumber kalimat nota digital (WhatsApp / preview).
 * Teks saja. Tidak mengirim gambar nota / gambar barcode.
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

function formatQtyUnit(it) {
  const display = String(it?.qtyDisplay || '').trim();
  if (display) return display.replace(/(\d)\.(\d)/g, '$1,$2');
  const qty = Number(it?.qty);
  const n = Number.isFinite(qty) ? qty : 1;
  const unit = it?.unit || 'Pcs';
  const num = /kg/i.test(unit)
    ? n.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  return `${num} ${unit}`;
}

function itemBlock(it) {
  const name = it?.name || it?.serviceName || 'Layanan';
  const unit = Number(it?.unitPrice) || 0;
  const sub = Number(it?.effectiveSubtotal ?? it?.subtotal) || 0;
  return [
    `✦ *${name}*`,
    `${formatQtyUnit(it)} · ${formatRp(unit)}`,
    `*${formatRp(sub)}*`
  ].join('\n');
}

function parseDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' && /Jam|Hari Kerja/i.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function wibParts(d) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: WIB_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);
}

function formatStamp(value, addDays = 0) {
  let d = parseDate(value);
  if (!d) return '-';
  if (addDays) {
    const key = toWibDateKey(d);
    const shifted = addWibDays(key, addDays);
    if (!shifted) return '-';
    const src = wibParts(d);
    const hh = src.find((p) => p.type === 'hour')?.value || '00';
    const mm = src.find((p) => p.type === 'minute')?.value || '00';
    d = new Date(`${shifted}T${hh}:${mm}:00+07:00`);
  }
  const parts = wibParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')}/${get('month')}/${get('year')} · ${get('hour')}:${get('minute')}`;
}

function selesaiStamp(receipt) {
  const est = receipt?.estimatedCompletion;
  if (est && !/Jam|Hari Kerja/i.test(String(est))) {
    const formatted = formatStamp(est);
    if (formatted !== '-') return formatted;
  }
  if (receipt?.estimatedAt) {
    const formatted = formatStamp(receipt.estimatedAt);
    if (formatted !== '-') return formatted;
  }
  const base = receipt?.createdAtRaw || receipt?.createdAt;
  return formatStamp(base, receipt?.isExpress ? 1 : 2);
}

const RULE = '━━━━━━━━━━━━━━';

/**
 * Ringkasan rincian pesanan untuk chat WA.
 */
export function buildDigitalNotaBody(receipt) {
  if (!receipt) return '';
  const orderNo = receipt.id || receipt.orderNo || '';
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  const detail = items.length
    ? items.map(itemBlock).join('\n\n')
    : `✦ *${receipt.serviceType || receipt.category || 'Layanan Laundry'}*`;

  return [
    '*WASCHEN PREMIUM LAUNDRY*',
    '',
    `*NOTA ${orderNo}*`,
    '',
    `Pelanggan: ${receipt.customerName || 'Pelanggan'}`,
    `Outlet: ${receipt.branch || '-'}`,
    `Terima: ${formatStamp(receipt.createdAtRaw || receipt.createdAt)}`,
    `Selesai: ${selesaiStamp(receipt)}`,
    '',
    '*DETAIL PESANAN*',
    '',
    detail,
    '',
    RULE,
    '',
    `*TOTAL · ${formatRp(receipt.grandTotal)}*`,
    `Pembayaran: *${paymentLabel(receipt)}*`
  ].join('\n');
}

/**
 * Teks lengkap yang di-prefill ke chat WhatsApp.
 * Wajib punya trackingUrl + accessCode yang valid dari server.
 */
export function buildDigitalNotaMessage(receipt, _settings = DEFAULT_CUSTOMER_SETTINGS) {
  const orderNo = receipt?.id || receipt?.orderNo || '';
  const trackingUrl = String(receipt?.trackingUrl || buildCustomerTrackingUrl(orderNo) || '').trim();
  const accessCode = String(receipt?.accessCode || '').replace(/\D/g, '');
  const body = buildDigitalNotaBody(receipt);
  const thanks = [
    '*Terima kasih telah mempercayakan perawatan pakaian Anda kepada Waschen*',
    '*Total Care for Happy Life*'
  ];

  if (!orderNo) {
    return 'Nomor nota tidak valid. Hubungi kasir Waschen.';
  }

  const track = (!trackingUrl || !/^https?:\/\//i.test(trackingUrl))
    ? 'PERHATIAN: Link tracking belum tersedia. Mohon hubungi kasir Waschen untuk mengirim ulang nota digital.'
    : (!/^\d{4}$/.test(accessCode)
      ? 'PERHATIAN: Kode akses belum siap. Mohon hubungi kasir Waschen untuk mengirim ulang nota digital.'
      : `${trackingUrl} · Kode *${accessCode}*`);

  return [
    body,
    '',
    '📦 *Lacak Pesanan & Syarat Ketentuan*',
    track,
    '',
    ...thanks
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
