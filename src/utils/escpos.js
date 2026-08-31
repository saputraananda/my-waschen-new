import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeCanvas } from 'qrcode.react';
import { buildNotaModel, NOTA_DASH, NOTA_WIDTH, wrapNotaText } from './notaModel.js';

const encoder = new TextEncoder();

function concat(...chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function text(str = '') {
  const safe = String(str)
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\x00-\x7F]/g, (ch) => {
      const map = {
        'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a',
        'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
        'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
        'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o',
        'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
        'ñ': 'n', 'ç': 'c', 'Á': 'A', 'É': 'E',
        'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N'
      };
      return map[ch] || '?';
    });
  return encoder.encode(safe);
}

function line(str = '') {
  return concat(text(str), Uint8Array.of(0x0a));
}

function cmd(...bytes) {
  return Uint8Array.from(bytes);
}

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

/** Lebar cetak 58mm ~ 384 dots (203dpi) — harus kelipatan 8 */
const PRINT_WIDTH = 384;
/**
 * QR side-by-side di 58mm (~384 dots).
 * Tanpa includeMargin agar modul memenuhi kotak (tidak terlihat kecil).
 * ~200 = besar + masih ada ruang teks kanan (~170 dots).
 */
const QR_PRINT_SIZE = 200;

function resetStyle() {
  return concat(SIZE_NORMAL, BOLD_OFF, ALIGN_LEFT);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pastikan QR canvas benar-benar ter-render sebelum dicetak */
async function waitForQrPixels(canvas, minDark = 80) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  for (let i = 0; i < 24; i++) {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let dark = 0;
    for (let p = 0; p < data.length; p += 16) {
      if (data[p] < 200) dark += 1;
    }
    if (dark >= minDark) return;
    await sleep(30);
  }
}

/**
 * Render QR ke canvas (pakai qrcode.react, sama seperti preview).
 */
async function renderQrCanvas(value, size) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await new Promise((resolve) => {
      root.render(createElement(QRCodeCanvas, {
        value: String(value || ''),
        size,
        level: 'M',
        includeMargin: false,
        bgColor: '#ffffff',
        fgColor: '#000000'
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

/**
 * Satu strip raster GS v 0.
 */
function canvasStripToRaster(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, w, h).data;
  const widthBytes = Math.ceil(w / 8);
  const data = new Uint8Array(widthBytes * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114;
      if (lum < 180) {
        data[y * widthBytes + (x >> 3)] |= (0x80 >> (x & 7));
      }
    }
  }

  return concat(
    cmd(0x1d, 0x76, 0x30, 0x00),
    cmd(widthBytes & 0xff, (widthBytes >> 8) & 0xff),
    cmd(h & 0xff, (h >> 8) & 0xff),
    data
  );
}

/** Raster header — selalu satu strip utuh (stabil di RPP02N) */
function canvasToRaster(canvas) {
  return concat(ALIGN_LEFT, canvasStripToRaster(canvas), line(''));
}

/**
 * Header mirip preview: QR kiri (utuh) + teks kanan.
 */
async function renderHeaderRaster(row) {
  const lines = (row.lines || []).map((l) => String(l || ''));
  const hasQr = !!row.qr;
  const qrSize = hasQr ? QR_PRINT_SIZE : 0;
  const pad = 4;
  const gap = 8;
  const lineH = 22;
  const bottomPad = 8;
  const textRows = Math.max(lines.length, 1);
  const textBlockH = textRows * lineH + pad;
  const height = Math.max(qrSize + pad + bottomPad, textBlockH + bottomPad);
  const width = PRINT_WIDTH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  let textX = pad;
  if (hasQr) {
    const qr = await renderQrCanvas(row.qr, qrSize);
    ctx.drawImage(qr, pad, pad, qrSize, qrSize);
    textX = pad + qrSize + gap;
  }

  const maxTextW = Math.max(40, width - textX - pad);
  lines.forEach((l, i) => {
    ctx.font = i === 0 ? 'bold 18px monospace' : '16px monospace';
    let remaining = l;
    while (ctx.measureText(remaining).width > maxTextW && remaining.length > 1) {
      remaining = remaining.slice(0, -1);
    }
    ctx.fillText(remaining, textX, pad + i * lineH);
  });

  return canvasToRaster(canvas);
}

function renderHeaderFallback(row) {
  const parts = [resetStyle()];
  (row.lines || []).forEach((l, i) => {
    if (i === 0) parts.push(BOLD_ON, line(String(l).slice(0, NOTA_WIDTH)), BOLD_OFF);
    else parts.push(line(String(l).slice(0, NOTA_WIDTH)));
  });
  return concat(...parts);
}

function buildTextRowSegment(row) {
  const parts = [resetStyle()];

  if (row.align === 'center') parts.push(ALIGN_CENTER);
  else parts.push(ALIGN_LEFT);

  if (row.size === 'huge') parts.push(SIZE_HUGE);
  else if (row.size === 'tall') parts.push(SIZE_TALL);
  else parts.push(SIZE_NORMAL);

  if (row.bold) parts.push(BOLD_ON);
  else parts.push(BOLD_OFF);

  const raw = String(row.text || '');
  const maxLen = row.size === 'huge' ? 16 : NOTA_WIDTH;

  if (row.size === 'huge') {
    if (raw.length > maxLen) {
      parts.push(line(raw.slice(0, maxLen)));
      parts.push(SIZE_HUGE, row.bold ? BOLD_ON : BOLD_OFF, line(raw.slice(maxLen, maxLen * 2)));
    } else {
      parts.push(line(raw.slice(0, maxLen)));
    }
  } else {
    for (const ln of wrapNotaText(raw, maxLen)) {
      parts.push(line(String(ln).slice(0, maxLen)));
    }
  }

  parts.push(resetStyle());
  return concat(...parts);
}

async function renderModel(rows) {
  const segments = [concat(INIT, resetStyle())];

  for (const row of rows) {
    if (row.type === 'blank') {
      segments.push(line(''));
      continue;
    }
    if (row.type === 'dash') {
      segments.push(concat(resetStyle(), line(NOTA_DASH)));
      continue;
    }
    if (row.type === 'header') {
      try {
        segments.push(await renderHeaderRaster(row));
      } catch (err) {
        console.warn('Header raster gagal, fallback teks:', err);
        segments.push(renderHeaderFallback(row));
      }
      segments.push(resetStyle());
      continue;
    }

    segments.push(buildTextRowSegment(row));
  }

  segments.push(concat(FEED_BEFORE_CUT, CUT));
  return segments;
}

export async function buildEscPosNota(receipt, settings, variant = 'customer') {
  if (!receipt || !settings) return INIT;
  const segments = await renderModel(buildNotaModel(receipt, settings, variant));
  return concat(...segments);
}

export async function buildEscPosDualNota(receipt, customerSettings, internalSettings) {
  const internal = await buildEscPosNota(receipt, internalSettings, 'internal');
  const customer = await buildEscPosNota(receipt, customerSettings, 'customer');
  return concat(internal, customer);
}
