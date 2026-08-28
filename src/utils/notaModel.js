import { on, PERHATIAN_ITEMS } from './printerSettings.js';
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
  getRackOrMeta
} from './notaLayout.js';

/** Lebar karakter efektif 58mm */
export const NOTA_WIDTH = 32;
export const NOTA_DASH = '-'.repeat(26);

export function wrapNotaText(str, width = NOTA_WIDTH) {
  const raw = String(str ?? '');
  if (!raw) return [''];
  const words = raw.split(/\s+/);
  const lines = [];
  let cur = '';

  const flushLong = (word) => {
    for (let i = 0; i < word.length; i += width) {
      lines.push(word.slice(i, i + width));
    }
  };

  for (const word of words) {
    if (!word) continue;
    if (word.length > width) {
      if (cur) {
        lines.push(cur);
        cur = '';
      }
      flushLong(word);
      continue;
    }
    if (!cur) cur = word;
    else if (`${cur} ${word}`.length <= width) cur = `${cur} ${word}`;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

export function padNotaRow(left, right, width = NOTA_WIDTH) {
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

function header(qrValue, lines) {
  return {
    type: 'header',
    qr: qrValue || null,
    lines: (lines || []).filter((l) => l != null && String(l).length)
  };
}

/**
 * INTERNAL — QR kiri + nama/telp/rak kanan (referensi gambar 1)
 */
export function buildInternalNotaModel(receipt, settings) {
  const rows = [];
  const rack = getRackOrMeta(receipt);
  const headLines = [];

  if (on(settings, 'show_customer_name')) headLines.push(receipt.customerName || '-');
  if (on(settings, 'show_customer_phone')) headLines.push(receipt.customerPhone || '-');
  if (rack) headLines.push(String(rack));

  if (on(settings, 'show_qr') || headLines.length) {
    rows.push(header(
      on(settings, 'show_qr') ? getQrValue(receipt) : null,
      headLines
    ));
  }

  rows.push(T(receipt.id || '', { bold: true, size: 'huge' }));

  if (on(settings, 'show_outlet_name')) {
    wrapNotaText(`Outlet : ${receipt.branch || '-'}`).forEach((l) => rows.push(T(l)));
  }
  if (on(settings, 'show_datetime')) {
    wrapNotaText(`Terima : ${getReceivedLabel(receipt)}`).forEach((l) => rows.push(T(l)));
  }

  rows.push(T('Estimasi Selesai :'));
  // nilai di baris berikut, indent seperti referensi
  rows.push(T(`       ${getEstimasiLabel(receipt)}`));

  if (on(settings, 'show_perfume')) {
    rows.push(T(`Parfum : ${receipt.perfume && receipt.perfume !== '-' ? receipt.perfume : '-'}`));
  }
  if (on(settings, 'show_notes') && receipt.generalNotes && receipt.generalNotes !== '-') {
    wrapNotaText(String(receipt.generalNotes)).forEach((l) => rows.push(T(l)));
  }

  rows.push({ type: 'dash' });
  rows.push(T('Layanan :'));
  for (const item of receipt.items || []) {
    wrapNotaText(`> ${formatItemTitle(item)}`).forEach((l) => rows.push(T(l)));
  }
  rows.push({ type: 'dash' });

  rows.push(T(`Sisa bayar : ${rupiah(getRemaining(receipt))}`));
  rows.push(T(getPaymentStatusShort(receipt), { bold: true, align: 'center' }));

  return rows;
}

/**
 * CUSTOMER — QR kiri + brand/outlet/telp kanan (referensi gambar 2)
 */
export function buildCustomerNotaModel(receipt, settings) {
  const rows = [];
  const items = receipt.items || [];
  const paid = Number(receipt.paidAmount) || 0;
  const grand = Number(receipt.grandTotal) || 0;
  const addr = receipt.customerAddress;
  const hasAddr = addr && addr !== '-' && String(addr).trim() !== '';
  const outletPhone = getOutletPhone(receipt);
  const outletAddr = getOutletAddress(receipt);
  const branch = receipt.branch || '-';

  const headLines = ['Waschen Laundry'];
  if (on(settings, 'show_outlet_name')) {
    headLines.push(branch);
    headLines.push(outletAddr || branch);
  } else if (outletAddr) {
    headLines.push(outletAddr);
  }
  if (outletPhone) headLines.push(outletPhone);

  rows.push(header(
    on(settings, 'show_qr') ? getQrValue(receipt) : null,
    headLines
  ));

  wrapNotaText(`Nota : ${receipt.id}`).forEach((l) => rows.push(T(l)));
  if (on(settings, 'show_customer_name')) {
    wrapNotaText(`Customer : ${receipt.customerName || '-'}`).forEach((l) => rows.push(T(l)));
  }
  if (on(settings, 'show_customer_phone')) {
    wrapNotaText(`Telp : ${receipt.customerPhone || '-'}`).forEach((l) => rows.push(T(l)));
  }
  if (on(settings, 'show_datetime')) {
    wrapNotaText(`Terima : ${getReceivedLabel(receipt)}`).forEach((l) => rows.push(T(l)));
  }
  wrapNotaText(`Estimasi Selesai : ${getEstimasiLabel(receipt)}`).forEach((l) => rows.push(T(l)));
  if (on(settings, 'show_perfume')) {
    wrapNotaText(`Parfum : ${receipt.perfume || 'Tanpa parfum'}`).forEach((l) => rows.push(T(l)));
  }
  if (on(settings, 'show_customer_address')) {
    if (hasAddr) wrapNotaText(`Alamat : ${addr}`).forEach((l) => rows.push(T(l)));
    else rows.push(T('Alamat Konsumen Kosong'));
  }

  rows.push({ type: 'dash' });
  rows.push(T('Layanan :'));
  for (const item of items) {
    const sub = Number(item.effectiveSubtotal || item.subtotal) || 0;
    const title = formatCustomerItemName(item);
    if (on(settings, 'show_item_price')) {
      rows.push(T(padNotaRow(title, rupiah(sub))));
      rows.push(T(`@ ${rupiah(getUnitPrice(item))}`));
    } else {
      wrapNotaText(title).forEach((l) => rows.push(T(l)));
    }
    rows.push(T(`- ${getItemQtyCount(item)} Barang`));
  }

  rows.push({ type: 'dash' });
  rows.push(T(`Total item: ${Math.round(countTotalBarang(items))} Item`));
  rows.push({ type: 'dash' });

  if (on(settings, 'show_total')) {
    rows.push(T(padNotaRow('Total :', rupiah(grand))));
    rows.push({ type: 'dash' });
    rows.push(T(padNotaRow('Grand Total', rupiah(grand)), { bold: true }));
  }

  if (on(settings, 'show_payment')) {
    rows.push(T('Pembayaran:'));
    if (paid > 0) {
      rows.push(T(padNotaRow(`- ${receipt.paymentMethod || 'Tunai'}`, rupiah(paid))));
    } else {
      rows.push(T('- Belum ada pembayaran'));
    }
    rows.push({ type: 'dash' });
    rows.push(T(padNotaRow('Status :', getPaymentStatusShort(receipt))));
  }

  rows.push({ type: 'dash' });
  if (on(settings, 'show_cashier')) {
    wrapNotaText(getCashierStamp(receipt)).forEach((l) => rows.push(T(l)));
  }

  if (on(settings, 'show_perhatian')) {
    rows.push(T('PERHATIAN :', { bold: true }));
    PERHATIAN_ITEMS.forEach((t, i) => {
      wrapNotaText(`${i + 1}. ${t}`).forEach((l) => rows.push(T(l)));
    });
  }

  if (on(settings, 'show_footer_thanks')) {
    rows.push(T('Terima kasih', { align: 'center' }));
  }

  return rows;
}

export function buildNotaModel(receipt, settings, variant = 'customer') {
  return variant === 'internal'
    ? buildInternalNotaModel(receipt, settings)
    : buildCustomerNotaModel(receipt, settings);
}
