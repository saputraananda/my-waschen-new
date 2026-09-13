import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';
import { normalizePhone } from './NormalizePhone.js';
import { getQrValue } from './notaLayout.js';
import { DEFAULT_CUSTOMER_SETTINGS } from './printerSettings.js';
import { formatDateId } from './FilterDate.js';
import { buildDigitalNotaMessage } from '../components/DigitalNota.jsx';

/** Nomor lokal 08… → digit WA internasional 62… */
export function toWhatsAppDigits(phone) {
  const local = normalizePhone(phone);
  if (!local) return '';
  if (local.startsWith('0')) return `62${local.slice(1)}`;
  return local;
}

function cleanPhone(phone) {
  if (phone == null) return '';
  const s = String(phone).trim();
  if (!s || s === '-') return '';
  return s;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeReceiptItems(itemsSrc, order) {
  const list = (itemsSrc || []).map((it) => {
    const qtyRaw = it.qty;
    const qtyNum = typeof qtyRaw === 'number'
      ? qtyRaw
      : parseFloat(String(qtyRaw ?? '').replace(/[^\d.]/g, '')) || 1;
    return {
      name: it.name || it.serviceName || order?.serviceType || 'Layanan',
      qty: qtyNum,
      qtyDisplay: it.qtyDisplay || (typeof qtyRaw === 'string' ? qtyRaw : undefined),
      unitPrice: Number(it.unitPrice) || 0,
      effectiveSubtotal: Number(it.effectiveSubtotal ?? it.subtotal) || 0,
      brand: it.brand,
      color: it.color,
      note: it.note || it.conditionNotes,
      isCleanox: Boolean(it.isCleanox)
    };
  });

  if (list.length) return list;

  const total = Number(order?.grandTotal ?? order?.totalAmount) || 0;
  return [{
    name: order?.serviceType || order?.category || 'Layanan Laundry',
    qty: 1,
    qtyDisplay: order?.qty || '1',
    unitPrice: total,
    effectiveSubtotal: total
  }];
}

/**
 * Samakan shape order dari Dashboard / History / Detail ke receipt ThermalNota.
 */
export function toCustomerNotaReceipt(order, itemsOverride) {
  if (!order) return null;
  const id = order.id || order.orderNo || order.order_no;
  return {
    id,
    customerName: order.customerName || 'Pelanggan',
    customerPhone: cleanPhone(order.customerPhone),
    customerAddress: order.customerAddress || '-',
    cashierName: order.cashierName || 'Kasir Waschen',
    branch: order.branch || localStorage.getItem('activeOutletName') || 'Waschen Laundry',
    createdAt: order.createdAt,
    createdAtRaw: order.createdAtRaw || order.rawDate || order.createdAt,
    perfume: order.perfume || 'Standar',
    isExpress: order.isExpress ?? /express/i.test(String(order.speed || '')),
    isDelivery: Boolean(order.isDelivery),
    discountAmount: Number(order.discountAmount) || 0,
    grandTotal: Number(order.grandTotal ?? order.totalAmount) || 0,
    paidAmount: Number(order.paidAmount) || 0,
    changeAmount: Number(order.changeAmount) || 0,
    paymentStatus: order.paymentStatus || 'Outstanding',
    paymentMethod: order.paymentMethod || '-',
    generalNotes: order.generalNotes || order.notes || order.specialNotes || '',
    estimatedCompletion: order.estimatedCompletion,
    estimatedAt: order.estimatedAt,
    outletPhone: order.outletPhone,
    outletAddress: order.outletAddress || order.branch,
    items: normalizeReceiptItems(itemsOverride || order.items, order)
  };
}

/** Map response GET /api/transactions/:id → receipt nota customer */
export function mapApiTransactionToReceipt(raw) {
  if (!raw) return null;
  const order = {
    id: raw.order_no,
    customerName: raw.customer_name || 'Pelanggan',
    customerPhone: cleanPhone(raw.customer_phone),
    customerAddress: raw.customer_address || '-',
    cashierName: raw.cashier_name || raw.cashier_employee_name || 'Kasir Waschen',
    branch: raw.outlet_name || raw.home_branch || localStorage.getItem('activeOutletName') || 'Waschen Laundry',
    createdAt: raw.order_date ? formatDateId(raw.order_date) : undefined,
    createdAtRaw: raw.order_date,
    perfume: raw.parfume_name || 'Standar',
    isExpress: Number(raw.speed_surcharge) > 0,
    isDelivery: raw.is_delivery === 1,
    discountAmount: parseFloat(raw.discount_amount) || 0,
    grandTotal: parseFloat(raw.grand_total) || 0,
    paidAmount: parseFloat(raw.paid_amount) || 0,
    changeAmount: parseFloat(raw.change_amount) || 0,
    paymentStatus: raw.payment_status || 'Outstanding',
    paymentMethod: raw.payment_method || '-',
    generalNotes: raw.special_notes || '',
    outletPhone: raw.outlet_phone,
    outletAddress: raw.outlet_address || raw.outlet_name,
    serviceType: raw.speed_name ? `${raw.order_category} - ${raw.speed_name}` : raw.order_category,
    category: raw.order_category,
    qty: raw.order_category === 'Kiloan'
      ? `${raw.total_weight_kg} Kg`
      : `${raw.total_pcs} Pcs`
  };
  const items = (raw.items || []).map((it) => ({
    name: it.service_name,
    qty: parseFloat(it.qty) || 0,
    qtyDisplay: `${parseFloat(it.qty) || 0} ${it.unit || 'Pcs'}`,
    unitPrice: parseFloat(it.unit_price) || 0,
    effectiveSubtotal: parseFloat(it.subtotal) || 0,
    brand: it.brand,
    color: it.color,
    note: it.condition_notes,
    isCleanox: it.is_cleanox === 1
  }));
  return toCustomerNotaReceipt(order, items);
}

/** Re-export builder kalimat dari DigitalNota (single source of truth). */
export { buildDigitalNotaMessage, buildCustomerNotaWhatsAppText } from '../components/DigitalNota.jsx';

/**
 * Render QR nota ke File PNG (isi = URL tracking, sama seperti struk).
 */
export async function buildNotaQrPngFile(receipt, size = 320) {
  const value = getQrValue(receipt);
  const orderNo = receipt?.id || 'nota';
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
        includeMargin: true,
        bgColor: '#ffffff',
        fgColor: '#000000'
      }));
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    await sleep(50);

    const src = host.querySelector('canvas');
    if (!src) throw new Error('QR canvas gagal dibuat');

    const blob = await new Promise((resolve, reject) => {
      src.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Gagal export QR PNG'))),
        'image/png'
      );
    });

    return new File([blob], `QR-${orderNo}.png`, { type: 'image/png' });
  } finally {
    try { root.unmount(); } catch { /* ignore */ }
    host.remove();
  }
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function openWhatsAppChat(digits, text) {
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Buka chat WA langsung ke nomor pelanggan dengan teks nota terisi.
 * Kalimat diambil dari DigitalNota.buildDigitalNotaMessage.
 */
export async function sendCustomerNotaWhatsApp(receipt, options = {}) {
  const settings = options.settings || DEFAULT_CUSTOMER_SETTINGS;
  const digits = toWhatsAppDigits(receipt?.customerPhone);
  if (!digits) {
    const err = new Error('Nomor WhatsApp pelanggan kosong');
    err.code = 'NO_PHONE';
    throw err;
  }

  const text = buildDigitalNotaMessage(receipt, settings);

  // Jangan pakai navigator.share(+files): di Windows/WA Desktop jadi picker
  // "Send message to" tanpa nomor & tanpa teks. Selalu deep-link wa.me.
  let downloadedQr = false;
  try {
    const qrFile = await buildNotaQrPngFile(receipt);
    if (qrFile) {
      downloadFile(qrFile);
      downloadedQr = true;
    }
  } catch {
    // teks + link tracking tetap cukup
  }

  openWhatsAppChat(digits, text);
  return {
    mode: 'wa_me',
    sharedImage: false,
    downloadedQr
  };
}

/**
 * Dari order list/detail: opsional fetch detail dulu biar isi nota lengkap, lalu buka WA.
 */
export async function sendCustomerNotaWhatsAppFromOrder(order, options = {}) {
  const { items, fetchDetail = true, ...sendOpts } = options;
  let receipt = toCustomerNotaReceipt(order, items);
  if (!receipt?.id) {
    const err = new Error('Nomor nota tidak valid');
    err.code = 'NO_ORDER';
    throw err;
  }

  if (fetchDetail) {
    try {
      const res = await axios.get(`/api/transactions/${encodeURIComponent(receipt.id)}`);
      if (res.data?.success && res.data.data) {
        const fresh = mapApiTransactionToReceipt(res.data.data);
        if (fresh) {
          if (!fresh.customerPhone && receipt.customerPhone) {
            fresh.customerPhone = receipt.customerPhone;
          }
          receipt = fresh;
        }
      }
    } catch {
      // pakai data lokal
    }
  }

  return sendCustomerNotaWhatsApp(receipt, sendOpts);
}

/** Pesan alert setelah buka WA. */
export function describeCustomerNotaWaResult(result) {
  if (!result || result.cancelled) return null;
  if (result.downloadedQr) {
    return {
      title: 'Chat WhatsApp Dibuka',
      message: 'Sudah masuk ke chat pelanggan dengan teks nota. Lampirkan file QR yang baru diunduh (opsional), lalu klik Send.',
      type: 'success'
    };
  }
  return {
    title: 'Chat WhatsApp Dibuka',
    message: 'Sudah masuk ke chat pelanggan dengan teks nota + link tracking. Cek lalu klik Send.',
    type: 'success'
  };
}
