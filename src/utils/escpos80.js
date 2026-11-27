/**
 * Cetak nota thermal 80mm (pilihan tambahan di samping 58mm).
 *
 * File ini berdiri sendiri: layout & perintah ESC/POS 58mm di escpos.js / notaModel.js /
 * mergeNotaModel.js TIDAK dipakai ulang dan TIDAK diubah. Isi nota (baris, toggle setting,
 * urutan) mengikuti versi 58mm, hanya lebarnya disesuaikan kertas 80mm:
 *   - 48 karakter per baris (Font A), raster header 576 dots (72mm @203dpi)
 *   - QR & huruf header lebih besar
 *
 * File ini identik di My Waschen POS (src/utils) dan Alora SuperApp (pages/my-waschen/utils).
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeCanvas } from 'qrcode.react';
import { on, PERHATIAN_ITEMS } from './printerSettings.js';
import { getNotaPricing } from './notaPricing.js';
import { formatWibDateTime } from './wib.js';
import {
  rupiah,
  getQrValue,
  getRemaining,
  getPaymentStatusShort,
  getReceivedLabel,
  getEstimasiLabel,
  getOutletPhone,
  getOutletAddress,
  countTotalBarang,
  formatItemTitle,
  formatCustomerItemName,
  getUnitPrice,
  getItemQtyCount,
  getCashierStamp,
  getRackOrMeta,
  groupNotaItems,
  getMemberNotaRows
} from './notaLayout.js';

/* ───────────────────────── ukuran kertas 80mm ───────────────────────── */

/** Lebar karakter efektif 80mm (Font A 12x24) */
export const NOTA80_WIDTH = 48;
export const NOTA80_DASH = '-'.repeat(NOTA80_WIDTH);
/** Lebar cetak 80mm ~ 576 dots (203dpi) — kelipatan 8 */
const PRINT_WIDTH = 576;
/** QR header kiri; sisa ~280 dots untuk teks kanan */
const QR_PRINT_SIZE = 280;
/** Teks ukuran 'huge' (lebar ganda) muat 24 karakter */
const HUGE_WIDTH = 24;

/* ───────────────────────── teks ───────────────────────── */

export function wrapNota80(str, width = NOTA80_WIDTH) {
  const raw = String(str ?? '');
  if (!raw) return [''];
  const lines = [];
  let cur = '';
  for (const word of raw.split(/\s+/)) {
    if (!word) continue;
    if (word.length > width) {
      if (cur) { lines.push(cur); cur = ''; }
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width));
      continue;
    }
    if (!cur) cur = word;
    else if (`${cur} ${word}`.length <= width) cur = `${cur} ${word}`;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

export function padNota80(left, right, width = NOTA80_WIDTH) {
  const L = String(left ?? '');
  const R = String(right ?? '');
  if (L.length + R.length >= width) {
    const maxL = Math.max(0, width - R.length - 1);
    return `${L.slice(0, maxL)} ${R}`.slice(0, width);
  }
  return L + ' '.repeat(width - L.length - R.length) + R;
}

function T(text, extra = {}) {
  return { type: 'text', text: String(text ?? ''), align: 'left', bold: false, size: 'normal', ...extra };
}

const DASH = { type: 'dash', text: NOTA80_DASH };

function header(qrValue, lines, title = null, size = 'normal') {
  const entries = (lines || [])
    .map((l) => (l != null && typeof l === 'object' ? l : { text: l }))
    .filter((l) => l.text != null && String(l.text).length);
  return {
    type: 'header',
    qr: qrValue || null,
    title: title || null,
    size,
    lines: entries.map((l) => String(l.text)),
    nowrap: entries.map((l, i) => (l.nowrap ? i : -1)).filter((i) => i >= 0)
  };
}

/* ───────────────────────── model nota (isi sama dengan 58mm) ───────────────────────── */

function estimasiLine(receipt) {
  const t = `Estimasi : ${getEstimasiLabel(receipt)}`;
  return t.length > NOTA80_WIDTH ? t.replace(', ', ' ') : t;
}

function pushTipe(rows, receipt, settings) {
  if (!on(settings, 'show_express')) return;
  const express = getNotaPricing(receipt).isExpress;
  rows.push(T(`Tipe : ${express ? 'EXPRESS' : 'Reguler'}`, express ? { bold: true } : {}));
}

function pushTotals(rows, receipt, settings) {
  const p = getNotaPricing(receipt);
  const showPromo = p.hasPromo && on(settings, 'show_discount');
  if (!p.hasSurcharge && !showPromo) {
    rows.push(T(padNota80('Total :', rupiah(p.grand))));
    rows.push(DASH);
    rows.push(T(padNota80('Grand Total', rupiah(p.grand)), { bold: true }));
    return;
  }
  if (p.hasSurcharge) {
    rows.push(T(padNota80('Subtotal :', rupiah(p.subtotal))));
    rows.push(T(padNota80('Biaya Express :', `+${rupiah(p.surcharge)}`)));
  }
  rows.push(T(padNota80('Harga Normal :', rupiah(p.original))));
  if (showPromo) {
    wrapNota80(`Promo : ${p.promoName}`).forEach((l) => rows.push(T(l)));
    rows.push(T(padNota80('Potongan Promo :', `-${rupiah(p.discount)}`)));
  }
  rows.push(DASH);
  rows.push(T(padNota80('Grand Total', rupiah(p.grand)), { bold: true }));
  if (showPromo) rows.push(T(`Anda hemat ${rupiah(p.discount)}`, { align: 'center' }));
}

const DC_TAG = '(DC)';

function pushItemText(rows, text, item) {
  const lines = wrapNota80(item?.isDryClean ? `${text} ${DC_TAG}` : text);
  lines.forEach((l, i) => {
    const isLast = i === lines.length - 1;
    rows.push(T(l, isLast && item?.isDryClean ? { boldTail: DC_TAG } : {}));
  });
}

/** INTERNAL — QR kiri + nama/telp/rak kanan */
export function buildInternalNotaModel80(receipt, settings) {
  const rows = [];
  const rack = getRackOrMeta(receipt);
  const headLines = [];
  const addr = receipt.customerAddress;
  const hasAddr = addr && addr !== '-' && String(addr).trim() !== '';

  if (on(settings, 'show_customer_name')) headLines.push(receipt.customerName || '-');
  if (on(settings, 'show_customer_address') && hasAddr) headLines.push(String(addr).trim());
  if (on(settings, 'show_customer_phone')) headLines.push({ text: receipt.customerPhone || '-', nowrap: true });
  if (rack) headLines.push(String(rack));

  if (on(settings, 'show_qr') || headLines.length) {
    rows.push(header(on(settings, 'show_qr') ? getQrValue(receipt) : null, headLines, null, 'large'));
  }

  rows.push(T(receipt.id || '', { bold: true, size: 'huge' }));
  pushTipe(rows, receipt, settings);

  if (on(settings, 'show_outlet_name')) {
    let outletLine = `Outlet : ${receipt.branch || '-'}`;
    if (outletLine.length > NOTA80_WIDTH) outletLine = outletLine.replace(/Outlet : Waschen Laundry +/i, 'Outlet : ');
    wrapNota80(outletLine).forEach((l) => rows.push(T(l)));
  }
  if (on(settings, 'show_datetime')) {
    wrapNota80(`Terima : ${getReceivedLabel(receipt)}`).forEach((l) => rows.push(T(l)));
  }
  rows.push(T(estimasiLine(receipt)));
  if (on(settings, 'show_perfume')) {
    rows.push(T(`Parfum : ${receipt.perfume && receipt.perfume !== '-' ? receipt.perfume : '-'}`));
  }
  if (on(settings, 'show_notes') && receipt.generalNotes && receipt.generalNotes !== '-') {
    wrapNota80(String(receipt.generalNotes)).forEach((l) => rows.push(T(l)));
  }

  rows.push(DASH);
  rows.push(T('Layanan :'));
  for (const item of groupNotaItems(receipt.items)) pushItemText(rows, `> ${formatItemTitle(item)}`, item);
  rows.push(DASH);

  rows.push(T(`Sisa bayar : ${rupiah(getRemaining(receipt))}`));
  rows.push(T(getPaymentStatusShort(receipt), { bold: true, align: 'center' }));
  return rows;
}

/** CUSTOMER — QR kiri + brand/outlet/telp kanan */
export function buildCustomerNotaModel80(receipt, settings) {
  const rows = [];
  const items = receipt.items || [];
  const paid = Number(receipt.paidAmount) || 0;
  const addr = receipt.customerAddress;
  const hasAddr = addr && addr !== '-' && String(addr).trim() !== '';
  const outletPhone = getOutletPhone(receipt);
  const outletAddr = getOutletAddress(receipt);
  const branch = receipt.branch || '-';

  const title = on(settings, 'show_outlet_name') && branch !== '-'
    ? (/^waschen/i.test(branch) ? branch : `Waschen Laundry ${branch}`)
    : 'Waschen Laundry';
  const headLines = [];
  if (outletAddr && outletAddr !== branch) headLines.push(outletAddr);
  if (outletPhone) headLines.push(outletPhone);
  rows.push(header(on(settings, 'show_qr') ? getQrValue(receipt) : null, headLines, title));

  pushTipe(rows, receipt, settings);
  wrapNota80(`Nota : ${receipt.id}`).forEach((l) => rows.push(T(l)));
  if (on(settings, 'show_customer_name')) {
    wrapNota80(`Customer : ${receipt.customerName || '-'}`).forEach((l) => rows.push(T(l)));
  }
  if (on(settings, 'show_customer_phone')) {
    wrapNota80(`Telp : ${receipt.customerPhone || '-'}`).forEach((l) => rows.push(T(l)));
  }
  if (on(settings, 'show_datetime')) {
    wrapNota80(`Terima : ${getReceivedLabel(receipt)}`).forEach((l) => rows.push(T(l)));
  }
  wrapNota80(estimasiLine(receipt)).forEach((l) => rows.push(T(l)));
  if (on(settings, 'show_perfume')) {
    wrapNota80(`Parfum : ${receipt.perfume || 'Tanpa parfum'}`).forEach((l) => rows.push(T(l)));
  }
  if (on(settings, 'show_customer_address')) {
    if (hasAddr) wrapNota80(`Alamat : ${addr}`).forEach((l) => rows.push(T(l)));
    else rows.push(T('Alamat Konsumen Kosong'));
  }

  rows.push(DASH);
  rows.push(T('Layanan :'));
  for (const item of groupNotaItems(items)) {
    const sub = Number(item.effectiveSubtotal || item.subtotal) || 0;
    const name = formatCustomerItemName(item);
    if (on(settings, 'show_item_price')) {
      rows.push(T(padNota80(name, rupiah(sub))));
      rows.push(T(`@ ${rupiah(getUnitPrice(item))}`));
    } else {
      wrapNota80(name).forEach((l) => rows.push(T(l)));
    }
    pushItemText(rows, `- ${getItemQtyCount(item)} Barang`, item);
  }

  rows.push(DASH);
  rows.push(T(`Total Item : ${Math.round(countTotalBarang(items))} Item`));
  rows.push(DASH);

  if (on(settings, 'show_total')) pushTotals(rows, receipt, settings);

  if (on(settings, 'show_payment')) {
    rows.push(T('Pembayaran:'));
    if (paid > 0) rows.push(T(padNota80(`- ${receipt.paymentMethod || 'Tunai'}`, rupiah(paid))));
    else rows.push(T('- Belum ada pembayaran'));
    rows.push(DASH);
    rows.push(T(padNota80('Status :', getPaymentStatusShort(receipt))));
  }

  // Blok member: Tipe Member, Saldo Sebelum, Saldo Terakhir, Masa Aktif
  const memberRows = getMemberNotaRows(receipt);
  if (memberRows.length) {
    rows.push(DASH);
    rows.push(T('MEMBER WASCHEN', { bold: true, align: 'center' }));
    memberRows.forEach(([label, value]) => {
      const left = `${label} :`;
      if (left.length + value.length + 1 > NOTA80_WIDTH) {
        rows.push(T(left));
        rows.push(T(padNota80('', value)));
      } else {
        rows.push(T(padNota80(left, value)));
      }
    });
  }

  rows.push(DASH);
  if (on(settings, 'show_cashier')) wrapNota80(getCashierStamp(receipt)).forEach((l) => rows.push(T(l)));

  if (on(settings, 'show_perhatian')) {
    rows.push(T('PERHATIAN :', { bold: true }));
    PERHATIAN_ITEMS.forEach((t, i) => wrapNota80(`${i + 1}. ${t}`).forEach((l) => rows.push(T(l))));
  }
  if (on(settings, 'show_footer_thanks')) rows.push(T('Terima kasih', { align: 'center' }));

  if (/^tunai$/i.test(String(receipt.paymentMethod || '').trim())) {
    rows.push({ type: 'blank' });
    rows.push(T('Tanda Terima Konsumen', { align: 'center', bold: true }));
    rows.push({ type: 'blank' });
    rows.push({ type: 'blank' });
    rows.push(T('________________________', { align: 'center' }));
  }
  return rows;
}

export function buildNotaModel80(receipt, settings, variant = 'customer') {
  return variant === 'internal'
    ? buildInternalNotaModel80(receipt, settings)
    : buildCustomerNotaModel80(receipt, settings);
}

/** Struk pelunasan gabungan (merged nota) 80mm */
export function buildMergeNotaModel80(batchData, options = {}) {
  if (!batchData) return [];
  const itemsList = batchData.settledTransactions || batchData.items || [];
  const batchNo = batchData.batchNo || batchData.batch_no || '-';
  const totalAmount = Number(batchData.totalAmount ?? batchData.total_amount ?? 0);
  const paidAmount = Number(batchData.paidAmount ?? batchData.paid_amount ?? totalAmount);
  const changeAmount = Number(batchData.changeAmount ?? batchData.change_amount ?? 0);
  const depositAdded = Number(batchData.depositAdded ?? batchData.deposit_added ?? 0);
  const paymentMethod = batchData.paymentMethod || batchData.payment_method || 'Tunai';
  const customerName = batchData.customer_name || batchData.customerName || options.customerName || '-';
  const customerPhone = batchData.customer_phone || batchData.customerPhone || options.customerPhone || '';
  const outletName = batchData.outlet_name || batchData.outletName || options.outletName || 'Outlet Waschen';
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const qrValue = options.qrValue
    || (batchNo && batchNo !== '-' ? `${origin}/dashboard?batchNo=${encodeURIComponent(batchNo)}` : null);
  const batchDate = formatWibDateTime(batchData?.createdAt || batchData?.created_at || batchData?.settledAt || new Date()) || '-';

  const rows = [header(qrValue, ['Waschen Laundry', outletName, 'STRUK PELUNASAN GABUNGAN'])];
  wrapNota80(`Batch : ${batchNo}`).forEach((l) => rows.push(T(l, { bold: true })));
  wrapNota80(`Tgl : ${batchDate}`).forEach((l) => rows.push(T(l)));
  wrapNota80(`Customer : ${customerName}`).forEach((l) => rows.push(T(l)));
  if (customerPhone) wrapNota80(`Telp : ${customerPhone}`).forEach((l) => rows.push(T(l)));

  rows.push(DASH);
  rows.push(T('Nota Dilunasi :', { bold: true }));
  itemsList.forEach((tx, idx) => {
    const orderNo = tx.orderNo || tx.order_no || '-';
    const orderCat = tx.orderCategory || tx.order_category || 'Laundry';
    const amtPaid = Number(tx.amountPaidThisBatch ?? tx.allocated_amount ?? tx.grandTotal ?? tx.grand_total ?? 0);
    wrapNota80(`${idx + 1}. ${orderNo}`).forEach((l) => rows.push(T(l, { bold: true })));
    rows.push(T(padNota80(orderCat, rupiah(amtPaid))));
    rows.push(T('   LUNAS', { bold: true }));
  });

  rows.push(DASH);
  rows.push(T(padNota80('TOTAL', rupiah(totalAmount)), { bold: true }));
  rows.push(T(padNota80(paymentMethod, rupiah(paidAmount))));
  if (paidAmount > totalAmount) {
    if (changeAmount > 0) rows.push(T(padNota80('Kembalian', rupiah(changeAmount))));
    if (depositAdded > 0) rows.push(T(padNota80('Ke Deposit', rupiah(depositAdded))));
  }
  rows.push(DASH);
  rows.push(T(`${itemsList.length} nota · 1x bayar`, { align: 'center', bold: true }));
  rows.push(T('Terima kasih', { align: 'center' }));
  wrapNota80('Bukti sah pelunasan gabungan').forEach((l) => rows.push(T(l, { align: 'center' })));
  return rows;
}

/* ───────────────────────── ESC/POS 80mm ───────────────────────── */

const encoder = new TextEncoder();

function concat(...chunks) {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

const ASCII_MAP = {
  'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i', 'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ñ': 'n', 'ç': 'c', 'Á': 'A', 'É': 'E',
  'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N'
};

function text(str = '') {
  const safe = String(str)
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\x00-\x7F]/g, (ch) => ASCII_MAP[ch] || '?');
  return encoder.encode(safe);
}

const line = (str = '') => concat(text(str), Uint8Array.of(0x0a));
const cmd = (...bytes) => Uint8Array.from(bytes);

const INIT = cmd(0x1b, 0x40);
const ALIGN_CENTER = cmd(0x1b, 0x61, 0x01);
const ALIGN_LEFT = cmd(0x1b, 0x61, 0x00);
const BOLD_ON = cmd(0x1b, 0x45, 0x01);
const BOLD_OFF = cmd(0x1b, 0x45, 0x00);
const SIZE_TALL = cmd(0x1d, 0x21, 0x01);
const SIZE_HUGE = cmd(0x1d, 0x21, 0x11);
const SIZE_NORMAL = cmd(0x1d, 0x21, 0x00);
const FEED_BEFORE_CUT = concat(cmd(0x1b, 0x64, 0x08), cmd(0x0a, 0x0a));
const CUT = cmd(0x1d, 0x56, 0x00);
/**
 * Paksa area cetak 80mm. Banyak printer menyimpan lebar area 58mm (384 dots) sebagai bawaan,
 * sehingga teks terbungkus di 32 karakter walau kertas 80mm (raster header tidak terpengaruh).
 *   ESC M 0  → Font A (12x24, 48 kolom di 576 dots)
 *   ESC SP 0 → jarak kanan huruf 0
 *   GS L 0   → margin kiri 0
 *   GS W 576 → lebar area cetak 576 dots
 */
const PRINT_AREA_80 = concat(
  cmd(0x1b, 0x4d, 0x00),
  cmd(0x1b, 0x20, 0x00),
  cmd(0x1d, 0x4c, 0x00, 0x00),
  cmd(0x1d, 0x57, PRINT_WIDTH & 0xff, (PRINT_WIDTH >> 8) & 0xff)
);

const resetStyle = () => concat(SIZE_NORMAL, BOLD_OFF, ALIGN_LEFT);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForQrPixels(canvas, minDark = 80) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  for (let i = 0; i < 24; i++) {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let dark = 0;
    for (let p = 0; p < data.length; p += 16) if (data[p] < 200) dark += 1;
    if (dark >= minDark) return;
    await sleep(30);
  }
}

async function renderQrCanvas(value, size) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await new Promise((resolve) => {
      root.render(createElement(QRCodeCanvas, {
        value: String(value || ''), size, level: 'M', includeMargin: false, bgColor: '#ffffff', fgColor: '#000000'
      }));
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    await sleep(40);
    const src = host.querySelector('canvas');
    if (!src) throw new Error('QR canvas gagal dibuat');
    await waitForQrPixels(src);
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(src, 0, 0, size, size);
    return out;
  } finally {
    try { root.unmount(); } catch { /* ignore */ }
    host.remove();
  }
}

function canvasToRaster(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const img = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const widthBytes = Math.ceil(w / 8);
  const data = new Uint8Array(widthBytes * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114 < 180) {
        data[y * widthBytes + (x >> 3)] |= (0x80 >> (x & 7));
      }
    }
  }
  return concat(
    ALIGN_LEFT,
    cmd(0x1d, 0x76, 0x30, 0x00),
    cmd(widthBytes & 0xff, (widthBytes >> 8) & 0xff),
    cmd(h & 0xff, (h >> 8) & 0xff),
    data,
    line('')
  );
}

function wrapCanvasText(ctx, str, maxW) {
  const out = [];
  let cur = '';
  for (const word of String(str || '').split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width <= maxW) { cur = next; continue; }
    if (cur) out.push(cur);
    let w = word;
    while (ctx.measureText(w).width > maxW && w.length > 1) w = w.slice(0, -1);
    cur = w;
  }
  if (cur) out.push(cur);
  return out;
}

// Huruf header 80mm ±1,4x versi 58mm
const TITLE_FONT = 'bold 30px monospace';
const TITLE_LINE_H = 36;

async function renderHeaderRaster(row) {
  const lines = (row.lines || []).map((l) => String(l || ''));
  const hasQr = !!row.qr;
  const qrSize = hasQr ? QR_PRINT_SIZE : 0;
  const pad = 6;
  const gap = 12;
  const lineH = 30;
  const bottomPad = 10;
  const width = PRINT_WIDTH;
  const textX = hasQr ? pad + qrSize + gap : pad;
  const maxTextW = Math.max(60, width - textX - pad);

  const canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  ctx.font = TITLE_FONT;
  const titleLines = row.title ? wrapCanvasText(ctx, row.title, maxTextW) : [];
  const titleH = titleLines.length * TITLE_LINE_H;

  const large = row.size === 'large';
  const laidOut = [];
  lines.forEach((l, i) => {
    const first = i === 0 && !titleLines.length;
    const font = first
      ? (large ? 'bold 36px monospace' : 'bold 25px monospace')
      : (large ? 'bold 30px monospace' : '22px monospace');
    const h = large ? (i === 0 ? 42 : 36) : lineH;
    ctx.font = font;
    if (large && ((row.nowrap || []).includes(i) || !l.trim().includes(' '))) {
      // Wajib satu baris (mis. no. telp): kecilkan huruf sampai muat
      let px = first ? 36 : 30;
      while (px > 16 && ctx.measureText(l).width > maxTextW) {
        px -= 1;
        ctx.font = `bold ${px}px monospace`;
      }
      laidOut.push({ text: l, font: ctx.font, h });
    } else if (large) {
      wrapCanvasText(ctx, l, maxTextW).forEach((t) => laidOut.push({ text: t, font, h }));
    } else {
      wrapCanvasText(ctx, l, maxTextW).forEach((t) => laidOut.push({ text: t, font, h }));
    }
  });
  const linesH = laidOut.reduce((sum, l) => sum + l.h, 0);
  const textBlockH = titleH + (laidOut.length || titleLines.length ? linesH : lineH) + pad;
  const height = Math.max(qrSize + pad + bottomPad, textBlockH + bottomPad);

  canvas.width = width;
  canvas.height = height;
  ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  if (hasQr) ctx.drawImage(await renderQrCanvas(row.qr, qrSize), pad, pad, qrSize, qrSize);

  ctx.font = TITLE_FONT;
  titleLines.forEach((l, i) => ctx.fillText(l, textX, pad + i * TITLE_LINE_H));
  let y = pad + titleH;
  laidOut.forEach((l) => {
    ctx.font = l.font;
    ctx.fillText(l.text, textX, y);
    y += l.h;
  });
  return canvasToRaster(canvas);
}

function renderHeaderFallback(row) {
  const parts = [resetStyle()];
  if (row.title) wrapNota80(row.title).forEach((l) => parts.push(BOLD_ON, line(l), BOLD_OFF));
  (row.lines || []).forEach((l, i) => {
    const texts = wrapNota80(l);
    if (i === 0 && !row.title) texts.forEach((t) => parts.push(BOLD_ON, line(t), BOLD_OFF));
    else texts.forEach((t) => parts.push(line(t)));
  });
  return concat(...parts);
}

function buildTextRowSegment(row) {
  const parts = [resetStyle(), row.align === 'center' ? ALIGN_CENTER : ALIGN_LEFT];
  if (row.size === 'huge') parts.push(SIZE_HUGE);
  else if (row.size === 'tall') parts.push(SIZE_TALL);
  else parts.push(SIZE_NORMAL);
  parts.push(row.bold ? BOLD_ON : BOLD_OFF);

  const raw = String(row.text || '');
  if (row.size === 'huge') {
    parts.push(line(raw.slice(0, HUGE_WIDTH)));
    if (raw.length > HUGE_WIDTH) {
      parts.push(SIZE_HUGE, row.bold ? BOLD_ON : BOLD_OFF, line(raw.slice(HUGE_WIDTH, HUGE_WIDTH * 2)));
    }
  } else {
    for (const ln of wrapNota80(raw)) {
      const s = String(ln).slice(0, NOTA80_WIDTH);
      const tail = row.boldTail;
      if (tail && s.endsWith(tail)) {
        parts.push(text(s.slice(0, -tail.length)), BOLD_ON, text(tail), row.bold ? BOLD_ON : BOLD_OFF, line(''));
      } else {
        parts.push(line(s));
      }
    }
  }
  parts.push(resetStyle());
  return concat(...parts);
}

async function renderModel(rows) {
  const segments = [concat(INIT, PRINT_AREA_80, resetStyle())];
  for (const row of rows) {
    if (row.type === 'blank') { segments.push(line('')); continue; }
    if (row.type === 'dash') { segments.push(concat(resetStyle(), line(row.text || NOTA80_DASH))); continue; }
    if (row.type === 'header') {
      try {
        segments.push(await renderHeaderRaster(row));
      } catch (err) {
        console.warn('Header raster 80mm gagal, fallback teks:', err);
        segments.push(renderHeaderFallback(row));
      }
      segments.push(resetStyle());
      continue;
    }
    segments.push(buildTextRowSegment(row));
  }
  segments.push(concat(FEED_BEFORE_CUT, CUT));
  return concat(...segments);
}

export async function buildEscPosNota80(receipt, settings, variant = 'customer') {
  if (!receipt || !settings) return INIT;
  return renderModel(buildNotaModel80(receipt, settings, variant));
}

export async function buildEscPosMergeNota80(batchData, options = {}) {
  if (!batchData) return INIT;
  return renderModel(buildMergeNotaModel80(batchData, options));
}

/* ───────────────────────── pilihan ukuran kertas (per perangkat) ───────────────────────── */

const PAPER_KEY = 'notaPaperSize';

/** '58' (bawaan, sama seperti sebelumnya) atau '80' */
export function getNotaPaperSize() {
  try {
    return localStorage.getItem(PAPER_KEY) === '80' ? '80' : '58';
  } catch {
    return '58';
  }
}

export function setNotaPaperSize(size) {
  try {
    localStorage.setItem(PAPER_KEY, size === '80' ? '80' : '58');
  } catch { /* abaikan */ }
}
