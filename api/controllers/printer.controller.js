import { myWaschenPool } from '../db/pool.js';

const FIELD_KEYS = [
  'show_outlet_name',
  'show_datetime',
  'show_customer_name',
  'show_customer_phone',
  'show_customer_address',
  'show_cashier',
  'show_item_price',
  'show_item_detail',
  'show_perfume',
  'show_express',
  'show_delivery',
  'show_discount',
  'show_total',
  'show_payment',
  'show_member_balance',
  'show_notes',
  'show_qr',
  'show_perhatian',
  'show_footer_thanks'
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

function rowToSettings(row, fallback) {
  if (!row) return { ...fallback };
  const out = { ...fallback };
  FIELD_KEYS.forEach((k) => {
    if (row[k] !== undefined && row[k] !== null) out[k] = Number(row[k]) ? 1 : 0;
  });
  return out;
}

/**
 * GET /api/printer-settings?outlet_id=
 */
export const getPrinterSettings = async (req, res) => {
  try {
    const outletId = parseInt(req.query.outlet_id, 10) || 0;

    const [rows] = await myWaschenPool.query(
      `SELECT * FROM mst_thermal_nota_setting
       WHERE outlet_id IN (?, 0)
       ORDER BY FIELD(outlet_id, ?) DESC, nota_type ASC`,
      [outletId, outletId]
    );

    const byType = { customer: null, internal: null };
    for (const row of rows) {
      if (!byType[row.nota_type]) byType[row.nota_type] = row;
    }

    return res.status(200).json({
      success: true,
      data: {
        outletId,
        customer: rowToSettings(byType.customer, DEFAULT_CUSTOMER_SETTINGS),
        internal: rowToSettings(byType.internal, DEFAULT_INTERNAL_SETTINGS),
        fieldLabels: FIELD_LABELS
      }
    });
  } catch (error) {
    console.error('getPrinterSettings:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat setting printer',
      error: error.message
    });
  }
};

/**
 * PUT /api/printer-settings
 * body: { outletId, customer: {...}, internal: {...} }
 */
export const savePrinterSettings = async (req, res) => {
  try {
    const outletId = parseInt(req.body.outletId, 10) || 0;
    const customer = req.body.customer || {};
    const internal = req.body.internal || {};

    const upsert = async (notaType, settings, defaults) => {
      const merged = rowToSettings({ ...defaults, ...settings }, defaults);
      const cols = FIELD_KEYS.join(', ');
      const placeholders = FIELD_KEYS.map(() => '?').join(', ');
      const updates = FIELD_KEYS.map((k) => `${k} = VALUES(${k})`).join(', ');
      const values = FIELD_KEYS.map((k) => merged[k] ? 1 : 0);

      await myWaschenPool.query(
        `INSERT INTO mst_thermal_nota_setting (outlet_id, nota_type, ${cols})
         VALUES (?, ?, ${placeholders})
         ON DUPLICATE KEY UPDATE ${updates}, updated_at = NOW()`,
        [outletId, notaType, ...values]
      );
      return merged;
    };

    const savedCustomer = await upsert('customer', customer, DEFAULT_CUSTOMER_SETTINGS);
    const savedInternal = await upsert('internal', internal, DEFAULT_INTERNAL_SETTINGS);

    return res.status(200).json({
      success: true,
      message: 'Setting printer berhasil disimpan',
      data: {
        outletId,
        customer: savedCustomer,
        internal: savedInternal
      }
    });
  } catch (error) {
    console.error('savePrinterSettings:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menyimpan setting printer',
      error: error.message
    });
  }
};
