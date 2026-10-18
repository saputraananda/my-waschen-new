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

/** Satu baris seperti "Terima": buang koma setelah hari jika lewat lebar kertas */
function estimasiLine(receipt) {
  const text = `Estimasi : ${getEstimasiLabel(receipt)}`;
  return text.length > NOTA_WIDTH ? text.replace(', ', ' ') : text;
}

function T(text, extra = {}) {
  return { type: 'text', text: String(text ?? ''), align: 'left', bold: false, size: 'normal', ...extra };
}

/** "Tipe : Express" / "Tipe : Reguler" (toggle Tipe Pengerjaan) */
function pushTipe(rows, receipt, settings) {
  if (on(settings, 'show_express')) rows.push(T(`Tipe : ${receipt.isExpress ? 'Express' : 'Reguler'}`));
}

const DC_TAG = '(DC)';

/** Teks item dibungkus; jika item DC, akhiran "(DC)" saja yang dicetak bold */
function pushItemText(rows, text, item) {
  const lines = wrapNotaText(item?.isDryClean ? `${text} ${DC_TAG}` : text);
  lines.forEach((l, i) => {
    const isLast = i === lines.length - 1;
    rows.push(T(l, isLast && item?.isDryClean ? { boldTail: DC_TAG } : {}));
  });
}

/**
 * title (opsional): judul besar yang boleh membungkus beberapa baris di samping QR
 * size 'large': baris lebih besar & dibungkus per kata (nota internal)
 */
function header(qrValue, lines, title = null, size = 'normal') {
  // Baris boleh string atau { text, nowrap: true } (mis. no. telp wajib satu baris)
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

/**
 * INTERNAL — QR kiri + nama/telp/rak kanan (referensi gambar 1)
 */
export function buildInternalNotaModel(receipt, settings) {
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
    rows.push(header(
      on(settings, 'show_qr') ? getQrValue(receipt) : null,
      headLines,
      null,
      'large'
    ));
  }

  rows.push(T(receipt.id || '', { bold: true, size: 'huge' }));
  pushTipe(rows, receipt, settings);

  if (on(settings, 'show_outlet_name')) {
    // Usahakan satu baris: buang awalan "Waschen Laundry" jika nama outlet kepanjangan
    let outletLine = `Outlet : ${receipt.branch || '-'}`;
    if (outletLine.length > NOTA_WIDTH) outletLine = outletLine.replace(/Outlet : Waschen Laundry +/i, 'Outlet : ');
    wrapNotaText(outletLine).forEach((l) => rows.push(T(l)));
  }
  if (on(settings, 'show_datetime')) {
    wrapNotaText(`Terima : ${getReceivedLabel(receipt)}`).forEach((l) => rows.push(T(l)));
  }

  rows.push(T(estimasiLine(receipt)));

  if (on(settings, 'show_perfume')) {
    rows.push(T(`Parfum : ${receipt.perfume && receipt.perfume !== '-' ? receipt.perfume : '-'}`));
  }
  if (on(settings, 'show_notes') && receipt.generalNotes && receipt.generalNotes !== '-') {
    wrapNotaText(String(receipt.generalNotes)).forEach((l) => rows.push(T(l)));
  }

  rows.push({ type: 'dash' });
  rows.push(T('Layanan :'));
  for (const item of receipt.items || []) {
    pushItemText(rows, `> ${formatItemTitle(item)}`, item);
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

  // Judul = nama outlet lengkap (mis. "Waschen Laundry Citra Gran"), tanpa diulang di baris bawahnya
  const title = on(settings, 'show_outlet_name') && branch !== '-'
    ? (/^waschen/i.test(branch) ? branch : `Waschen Laundry ${branch}`)
    : 'Waschen Laundry';
  const headLines = [];
  if (outletAddr && outletAddr !== branch) headLines.push(outletAddr);
  if (outletPhone) headLines.push(outletPhone);

  rows.push(header(
    on(settings, 'show_qr') ? getQrValue(receipt) : null,
    headLines,
    title
  ));

  pushTipe(rows, receipt, settings);

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
  wrapNotaText(estimasiLine(receipt)).forEach((l) => rows.push(T(l)));
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
    pushItemText(rows, `- ${getItemQtyCount(item)} Barang`, item);
  }

  rows.push({ type: 'dash' });
  rows.push(T(`Total Item : ${Math.round(countTotalBarang(items))} Item`));
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

  if (/^tunai$/i.test(String(receipt.paymentMethod || '').trim())) {
    rows.push({ type: 'blank' });
    rows.push(T('Tanda Terima Konsumen', { align: 'center', bold: true }));
    rows.push({ type: 'blank' });
    rows.push({ type: 'blank' });
    rows.push(T('________________________', { align: 'center' }));
  }

  return rows;
}

export function buildNotaModel(receipt, settings, variant = 'customer') {
  return variant === 'internal'
    ? buildInternalNotaModel(receipt, settings)
    : buildCustomerNotaModel(receipt, settings);
}
