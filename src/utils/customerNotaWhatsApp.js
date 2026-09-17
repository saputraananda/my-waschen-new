import axios from 'axios';
import { normalizePhone } from './NormalizePhone.js';
import { DEFAULT_CUSTOMER_SETTINGS } from './printerSettings.js';
import { formatDateId } from './FilterDate.js';
import { buildDigitalNotaMessage } from '../components/DigitalNota.jsx';
import { buildCustomerTrackingUrl } from './customerTrackingUrl.js';

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
    accessCode: order.accessCode || order.access_code || '',
    trackingUrl: order.trackingUrl || order.tracking_url || '',
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
      : `${raw.total_pcs} Pcs`,
    accessCode: raw.access_code || '',
    trackingUrl: raw.tracking_url || ''
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
 * Ambil / generate kode akses + URL tracking dari server (sumber kebenaran).
 */
export async function ensureDigitalNotaAccess(orderNo) {
  const key = String(orderNo || '').trim();
  if (!key) {
    const err = new Error('Nomor nota tidak valid');
    err.code = 'NO_ORDER';
    throw err;
  }

  let res;
  try {
    res = await axios.post(`/api/transactions/${encodeURIComponent(key)}/digital-nota-access`);
  } catch (axiosErr) {
    const data = axiosErr?.response?.data;
    const err = new Error(
      data?.message
      || (axiosErr?.response?.status === 503
        ? 'Layanan nota digital belum siap (cek migrasi DB / CUSTOMER_APP_URL).'
        : (axiosErr?.message || 'Gagal menyiapkan kode akses nota digital'))
    );
    err.code = data?.code || 'ACCESS_FAILED';
    throw err;
  }

  if (!res.data?.success || !res.data?.data) {
    const err = new Error(res.data?.message || 'Gagal menyiapkan kode akses nota digital');
    err.code = res.data?.code || 'ACCESS_FAILED';
    throw err;
  }

  const { accessCode, trackingUrl, orderNo: resolvedNo } = res.data.data;
  if (!/^\d{4}$/.test(String(accessCode || ''))) {
    const err = new Error('Kode akses tidak valid dari server');
    err.code = 'BAD_ACCESS_CODE';
    throw err;
  }
  if (!trackingUrl || !/^https?:\/\//i.test(trackingUrl)) {
    const err = new Error('Link tracking tidak valid. Cek VITE_CUSTOMER_APP_URL / CUSTOMER_APP_URL.');
    err.code = 'BAD_TRACKING_URL';
    throw err;
  }

  return {
    orderNo: resolvedNo || key,
    accessCode: String(accessCode),
    trackingUrl: String(trackingUrl)
  };
}

function openWhatsAppChat(digits, text) {
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Buka chat WA langsung ke nomor pelanggan dengan teks nota digital.
 * Tidak mengirim / mengunduh gambar nota atau QR.
 */
export async function sendCustomerNotaWhatsApp(receipt, options = {}) {
  const settings = options.settings || DEFAULT_CUSTOMER_SETTINGS;
  const digits = toWhatsAppDigits(receipt?.customerPhone);
  if (!digits) {
    const err = new Error('Nomor WhatsApp pelanggan kosong');
    err.code = 'NO_PHONE';
    throw err;
  }

  const access = await ensureDigitalNotaAccess(receipt?.id);
  const enriched = {
    ...receipt,
    id: access.orderNo || receipt.id,
    accessCode: access.accessCode,
    trackingUrl: access.trackingUrl || buildCustomerTrackingUrl(access.orderNo || receipt.id)
  };

  const text = buildDigitalNotaMessage(enriched, settings);
  if (/PERHATIAN:/.test(text)) {
    const err = new Error('Nota digital belum lengkap (link/kode akses). Cek konfigurasi server.');
    err.code = 'INCOMPLETE_NOTA';
    throw err;
  }

  openWhatsAppChat(digits, text);
  return {
    mode: 'wa_me',
    sharedImage: false,
    downloadedQr: false,
    accessCode: access.accessCode,
    trackingUrl: enriched.trackingUrl
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
  return {
    title: 'Chat WhatsApp Dibuka',
    message: 'Sudah masuk ke chat pelanggan dengan greeting, rincian, link tracking, dan kode akses 4 digit. Cek lalu klik Send.',
    type: 'success'
  };
}
