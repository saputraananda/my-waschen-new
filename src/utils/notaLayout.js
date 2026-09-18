import { PERHATIAN_ITEMS } from './printerSettings.js';
import { formatEmployeeName } from './FormatName.js';
import { getCustomerTrackingQrValue } from './customerTrackingUrl.js';
import { WIB_TZ, addWibDays, toWibDateKey } from './wib.js';

export { PERHATIAN_ITEMS };

export function rupiah(n) {
  return `Rp${Number(n || 0).toLocaleString('id-ID')}`;
}

/** Format tanggal nota: "Kamis, 27/08/26 14:03" — selalu Asia/Jakarta */
export function formatNotaDateTime(value, addDays = 0) {
  if (!value && addDays === 0) return '-';

  let d = null;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === 'string') {
    if (/^\s*[A-Za-zÀ-ÿ]+,/.test(value) || value.includes('Jam') || value.includes('Hari')) {
      if (addDays === 0) return value;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  } else if (typeof value === 'number') {
    d = new Date(value);
  }

  if (!d || Number.isNaN(d.getTime())) {
    d = new Date();
  }

  if (addDays) {
    const key = toWibDateKey(d);
    const shifted = addWibDays(key, addDays);
    // noon WIB agar tidak geser hari
    d = new Date(`${shifted}T12:00:00+07:00`);
  }

  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB_TZ,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const weekday = get('weekday');
  const cap = weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : '';
  return `${cap}, ${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

export function getQrValue(receipt) {
  // Arahkan ke Waschen Customer /tracking — bukan origin POS
  const url = getCustomerTrackingQrValue(receipt);
  if (url) return url;
  // Fallback aman: hanya nomor nota (bukan URL POS yang salah)
  return String(receipt?.id || '').trim();
}

export function getRemaining(receipt) {
  return Math.max(0, (Number(receipt?.grandTotal) || 0) - (Number(receipt?.paidAmount) || 0));
}

export function getPaymentStatusShort(receipt) {
  const ps = receipt?.paymentStatus || 'Lunas';
  if (ps === 'Lunas') return 'Lunas';
  if (ps === 'DP') return 'DP';
  return 'Belum Lunas';
}

export function getReceivedLabel(receipt) {
  return formatNotaDateTime(receipt?.createdAtRaw || receipt?.createdAt || new Date());
}

export function getEstimasiLabel(receipt) {
  if (receipt?.estimatedCompletion
    && !/Jam|Hari Kerja/i.test(String(receipt.estimatedCompletion))) {
    return formatNotaDateTime(receipt.estimatedCompletion);
  }
  if (receipt?.estimatedAt) return formatNotaDateTime(receipt.estimatedAt);

  const base = receipt?.createdAtRaw || receipt?.createdAt || new Date();
  const days = receipt?.isExpress ? 1 : 2;
  // Kalau estimasi teks bebas (1x24 Jam), tetap hitung tanggal konkret untuk nota
  return formatNotaDateTime(base, days);
}

export function getOutletPhone(receipt) {
  return receipt?.outletPhone
    || localStorage.getItem('activeOutletPhone')
    || localStorage.getItem('outletPhone')
    || '';
}

export function getOutletAddress(receipt) {
  return receipt?.outletAddress
    || receipt?.branchAddress
    || receipt?.branch
    || '';
}

export function countTotalBarang(items = []) {
  return items.reduce((sum, it) => {
    const q = Number(it.qty);
    if (!Number.isNaN(q) && q > 0) return sum + q;
    // fallback: parse dari qtyDisplay "3 kg" / "2 Pcs"
    const m = String(it.qtyDisplay || '').match(/([\d.]+)/);
    return sum + (m ? parseFloat(m[1]) || 1 : 1);
  }, 0);
}

export function formatItemTitle(item) {
  // Internal style: "12.6 KG - Setrika (Kg)"
  const qty = item.qtyDisplay || (item.qty != null ? `${item.qty}` : '');
  const name = item.name || item.serviceName || 'Layanan';
  if (qty) return `${qty} - ${name}`;
  return name;
}

export function formatCustomerItemName(item) {
  // Customer style: "Sandal Dewasa 1 PCS"
  const name = item.name || item.serviceName || 'Layanan';
  const qty = item.qtyDisplay || '';
  if (!qty) return name;
  // Jika nama belum mengandung qty
  if (String(name).toLowerCase().includes(String(qty).toLowerCase().split(' ')[0])) {
    return name;
  }
  return `${name} ${qty}`.trim();
}

export function getUnitPrice(item) {
  if (item.unitPrice != null) return Number(item.unitPrice) || 0;
  const qty = Number(item.qty);
  const sub = Number(item.effectiveSubtotal || item.subtotal) || 0;
  if (qty > 0) return Math.round(sub / qty);
  return sub;
}

export function getItemQtyCount(item) {
  const q = Number(item.qty);
  if (!Number.isNaN(q) && q > 0) {
    // untuk kg tampilkan sebagai 1 barang per line item di style referensi "N Barang"
    // referensi: "- 2 Barang" untuk 2 pasang
    return Number.isInteger(q) ? q : 1;
  }
  const m = String(item.qtyDisplay || '').match(/([\d.]+)/);
  if (!m) return 1;
  const n = parseFloat(m[1]);
  return Number.isInteger(n) ? n : 1;
}

export function getCashierStamp(receipt) {
  const when = (() => {
    try {
      const d = receipt?.createdAtRaw ? new Date(receipt.createdAtRaw) : new Date();
      if (Number.isNaN(d.getTime())) return new Date().toLocaleString('id-ID');
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    } catch {
      return '';
    }
  })();
  const name = formatEmployeeName(receipt?.cashierName || receipt?.cashierFullName || 'Kasir');
  return `${when} ${name}`.trim();
}

export function getRackOrMeta(receipt) {
  if (receipt?.rackNo != null && receipt.rackNo !== '') return String(receipt.rackNo);
  if (receipt?.queueNo != null && receipt.queueNo !== '') return String(receipt.queueNo);
  const total = Math.round(countTotalBarang(receipt?.items || []));
  return total > 0 ? String(total) : '';
}
