import axios from 'axios';

export const PERHATIAN_ITEMS = [
  'Pengambilan barang harap disertai nota',
  'Barang tidak diambil >1 bulan: biaya penyimpanan Rp1.000/hari',
  'Barang tidak diambil >2 bulan jika hilang/rusak diluar tanggung jawab kami',
  'Barang hilang/rusak karena proses pengerjaan diganti maksimal 10x biaya cuci, Rp300.000',
  'Klaim luntur tidak dipisah diluar tanggungan',
  'Hak klaim berlaku 2 jam setelah barang diambil',
  'Kami tidak bertanggung jawab atas kerusakan karena force majeure seperti bencana alam dll.',
  'Setiap konsumen dianggap setuju dengan isi perhitungan tersebut diatas'
];

export const DEFAULT_CUSTOMER_SETTINGS = {
  show_outlet_name: 1,
  show_datetime: 1,
  show_customer_name: 1,
  show_customer_phone: 1,
  show_customer_address: 1,
  show_cashier: 1,
  show_item_price: 1,
  show_item_detail: 1,
  show_perfume: 1,
  show_express: 1,
  show_delivery: 1,
  show_discount: 1,
  show_total: 1,
  show_payment: 1,
  show_member_balance: 1,
  show_notes: 1,
  show_qr: 1,
  show_perhatian: 1,
  show_footer_thanks: 1
};

export const DEFAULT_INTERNAL_SETTINGS = {
  show_outlet_name: 1,
  show_datetime: 1,
  show_customer_name: 1,
  show_customer_phone: 1,
  show_customer_address: 0,
  show_cashier: 1,
  show_item_price: 0,
  show_item_detail: 1,
  show_perfume: 1,
  show_express: 1,
  show_delivery: 1,
  show_discount: 0,
  show_total: 0,
  show_payment: 0,
  show_member_balance: 0,
  show_notes: 1,
  show_qr: 1,
  show_perhatian: 0,
  show_footer_thanks: 0
};

export const FIELD_LABELS = [
  { key: 'show_outlet_name', label: 'Nama Outlet' },
  { key: 'show_datetime', label: 'Tanggal / Waktu' },
  { key: 'show_customer_name', label: 'Nama Pelanggan' },
  { key: 'show_customer_phone', label: 'No. Telepon' },
  { key: 'show_customer_address', label: 'Alamat Pelanggan' },
  { key: 'show_cashier', label: 'Nama Kasir' },
  { key: 'show_item_price', label: 'Harga Item' },
  { key: 'show_item_detail', label: 'Detail Item (merk/warna/ukuran)' },
  { key: 'show_perfume', label: 'Aroma Parfum' },
  { key: 'show_express', label: 'Tipe Pengerjaan (Express/Reguler)' },
  { key: 'show_delivery', label: 'Tipe Pengambilan' },
  { key: 'show_discount', label: 'Diskon Promo' },
  { key: 'show_total', label: 'Total Tagihan' },
  { key: 'show_payment', label: 'Rincian Pembayaran' },
  { key: 'show_member_balance', label: 'Saldo Member' },
  { key: 'show_notes', label: 'Catatan Order' },
  { key: 'show_qr', label: 'QR Tracking' },
  { key: 'show_perhatian', label: 'Syarat & Ketentuan (PERHATIAN)' },
  { key: 'show_footer_thanks', label: 'Footer Terima Kasih' }
];

export function on(settings, key) {
  return Number(settings?.[key]) === 1;
}

/** Map response DB transaksi → format receipt ThermalNota */
export function mapDbTransactionToReceipt(raw, fallbackOutletName = '') {
  if (!raw) return null;

  const items = (raw.items || []).map((it) => {
    const qty = parseFloat(it.qty) || 0;
    const unit = it.unit || 'Pcs';
    return {
      name: it.service_name || it.name || 'Layanan',
      qty,
      qtyDisplay: `${qty} ${unit}`,
      unitPrice: parseFloat(it.unit_price) || 0,
      effectiveSubtotal: parseFloat(it.subtotal) || 0,
      brand: it.brand || '-',
      color: it.color || '-',
      size: it.size || '-',
      note: it.condition_notes || it.note || '-',
      isDryClean: it.is_dry_clean === 1 || it.laundry_method_code === 'DC',
      isCleanox: it.is_cleanox === 1,
      laundry_method_code: it.laundry_method_code
    };
  });

  const paid = parseFloat(raw.paid_amount) || 0;
  const grand = parseFloat(raw.grand_total) || 0;

  return {
    id: raw.order_no || raw.id,
    dbId: raw.id,
    branch: raw.outlet_name || raw.home_branch || fallbackOutletName || 'Waschen Laundry',
    outletAddress: raw.outlet_name || raw.home_branch || fallbackOutletName || '',
    outletPhone: raw.outlet_phone || localStorage.getItem('activeOutletPhone') || '',
    createdAt: raw.order_date
      ? new Date(raw.order_date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
      : '',
    createdAtRaw: raw.order_date,
    customerName: raw.customer_name || 'Pelanggan',
    customerPhone: raw.customer_phone || '-',
    customerAddress: raw.customer_address || '',
    cashierName: raw.cashier_name || 'Kasir Waschen',
    perfume: raw.parfume_name || 'Tanpa parfum',
    isExpress: Number(raw.speed_surcharge) > 0 || /express/i.test(String(raw.speed_name || '')),
    isDelivery: raw.is_delivery === 1,
    discountAmount: parseFloat(raw.discount_amount) || 0,
    grandTotal: grand,
    paidAmount: paid,
    changeAmount: parseFloat(raw.change_amount) || 0,
    depositAdded: parseFloat(raw.deposit_added) || 0,
    paymentStatus: raw.payment_status || (paid >= grand && grand > 0 ? 'Lunas' : 'Outstanding'),
    paymentMethod: raw.payment_method || '-',
    paymentBatchNo: raw.payment_batch_no || null,
    customerBalance: parseFloat(raw.member_balance || raw.customer_deposit_balance || 0),
    generalNotes: raw.special_notes || '',
    rackNo: raw.rack_no || raw.queue_no || null,
    estimatedAt: raw.estimated_finished_at || null,
    estimatedCompletion: raw.estimated_finished_at || null,
    items
  };
}

/**
 * Ambil transaksi terbaru outlet dari DB untuk preview / test print.
 * Tidak memakai data dummy.
 */
export async function fetchLatestReceiptFromDb(outletId, outletName = '') {
  const oid = outletId || localStorage.getItem('activeOutletId') || '';
  const params = { limit: 1 };
  if (oid && oid !== 'Semua') params.outlet_id = oid;

  const listRes = await axios.get('/api/transactions', { params });
  const rows = listRes.data?.data || [];
  if (!listRes.data?.success || !rows.length) {
    return null;
  }

  const latest = rows[0];
  // List sudah include items, tapi detail punya join service_code/method lebih lengkap
  try {
    const detailRes = await axios.get(`/api/transactions/${latest.order_no || latest.id}`);
    if (detailRes.data?.success && detailRes.data.data) {
      return mapDbTransactionToReceipt(detailRes.data.data, outletName);
    }
  } catch (err) {
    console.warn('fetchLatestReceiptFromDb detail fallback:', err);
  }

  return mapDbTransactionToReceipt(latest, outletName);
}

export async function fetchPrinterSettings(outletId) {
  const oid = outletId || localStorage.getItem('activeOutletId') || 0;
  try {
    const res = await axios.get('/api/printer-settings', {
      params: { outlet_id: oid }
    });
    if (res.data?.success && res.data.data) {
      return {
        outletId: res.data.data.outletId,
        customer: { ...DEFAULT_CUSTOMER_SETTINGS, ...res.data.data.customer },
        internal: { ...DEFAULT_INTERNAL_SETTINGS, ...res.data.data.internal },
        fieldLabels: res.data.data.fieldLabels || FIELD_LABELS
      };
    }
  } catch (err) {
    console.error('fetchPrinterSettings:', err);
  }
  return {
    outletId: Number(oid) || 0,
    customer: { ...DEFAULT_CUSTOMER_SETTINGS },
    internal: { ...DEFAULT_INTERNAL_SETTINGS },
    fieldLabels: FIELD_LABELS
  };
}
