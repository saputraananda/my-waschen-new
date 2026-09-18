import { NOTA_WIDTH, wrapNotaText, padNotaRow } from './notaModel.js';
import { rupiah } from './notaLayout.js';
import { formatWibDateTime } from './wib.js';

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

function formatBatchDate(batchData) {
  const raw = batchData?.createdAt || batchData?.created_at || batchData?.settledAt;
  return formatWibDateTime(raw || new Date()) || '-';
}

/**
 * Layout thermal 58mm untuk struk pelunasan gabungan (merged nota).
 * Shape rows kompatibel dengan renderModel di escpos.js / ThermalNotaBody.
 */
export function buildMergeNotaModel(batchData, options = {}) {
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

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  const qrValue =
    options.qrValue ||
    (batchNo && batchNo !== '-'
      ? `${origin}/dashboard?batchNo=${encodeURIComponent(batchNo)}`
      : null);

  const rows = [];

  rows.push(
    header(qrValue, [
      'Waschen Laundry',
      outletName,
      'STRUK PELUNASAN GABUNGAN'
    ])
  );

  wrapNotaText(`Batch : ${batchNo}`).forEach((l) => rows.push(T(l, { bold: true })));
  wrapNotaText(`Tgl : ${formatBatchDate(batchData)}`).forEach((l) => rows.push(T(l)));
  wrapNotaText(`Customer : ${customerName}`).forEach((l) => rows.push(T(l)));
  if (customerPhone) {
    wrapNotaText(`Telp : ${customerPhone}`).forEach((l) => rows.push(T(l)));
  }

  rows.push({ type: 'dash' });
  rows.push(T('Nota Dilunasi :', { bold: true }));

  itemsList.forEach((tx, idx) => {
    const orderNo = tx.orderNo || tx.order_no || '-';
    const orderCat = tx.orderCategory || tx.order_category || 'Laundry';
    const amtPaid = Number(
      tx.amountPaidThisBatch ?? tx.allocated_amount ?? tx.grandTotal ?? tx.grand_total ?? 0
    );
    wrapNotaText(`${idx + 1}. ${orderNo}`).forEach((l) => rows.push(T(l, { bold: true })));
    rows.push(T(padNotaRow(orderCat, rupiah(amtPaid))));
    rows.push(T('   LUNAS', { bold: true }));
  });

  rows.push({ type: 'dash' });
  rows.push(T(padNotaRow('TOTAL', rupiah(totalAmount)), { bold: true }));
  rows.push(T(padNotaRow(paymentMethod, rupiah(paidAmount))));

  if (paidAmount > totalAmount) {
    if (changeAmount > 0) {
      rows.push(T(padNotaRow('Kembalian', rupiah(changeAmount))));
    }
    if (depositAdded > 0) {
      rows.push(T(padNotaRow('Ke Deposit', rupiah(depositAdded))));
    }
  }

  rows.push({ type: 'dash' });
  rows.push(T(`${itemsList.length} nota · 1x bayar`, { align: 'center', bold: true }));
  rows.push(T('Terima kasih', { align: 'center' }));
  wrapNotaText('Bukti sah pelunasan gabungan').forEach((l) =>
    rows.push(T(l, { align: 'center' }))
  );

  return rows;
}

export { NOTA_WIDTH };
