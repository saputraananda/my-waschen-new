/**
 * Normalisasi nilai rupiah ke integer (tanpa desimal).
 * Menangani:
 * - number: 500000 / 500000.00
 * - string DECIMAL DB: "500000.00"  → 500000  (bukan 50.000.000)
 * - format ID: "500.000" / "50.000.000"
 */
const toIntegerRupiah = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.round(val);
  }

  let s = String(val).trim().replace(/Rp\s?/gi, '').replace(/\s/g, '');
  if (!s) return 0;

  // Desimal DB / float string: "500000.00", "25000.5"
  if (/^\d+[.,]\d{1,2}$/.test(s)) {
    return Math.round(parseFloat(s.replace(',', '.')));
  }

  // Format Indonesia / input kasir: buang pemisah ribuan
  const cleanStr = s.replace(/[.,]/g, '').replace(/[^0-9]/g, '');
  return cleanStr ? parseInt(cleanStr, 10) : 0;
};

/**
 * Helper utility for formatting numbers into Indonesian Rupiah format with thousand separators
 * Example: 50000 -> "50.000", 5000000 -> "5.000.000"
 */
export const formatRupiah = (val, withPrefix = false) => {
  if (val === null || val === undefined || val === '') return '';

  const num = toIntegerRupiah(val);
  if (!num && String(val).replace(/[^0-9]/g, '') === '') return '';

  const formatted = num.toLocaleString('id-ID');
  return withPrefix ? `Rp ${formatted}` : formatted;
};

/**
 * Utility to parse formatted Rupiah string back to raw number
 * Example: "5.000.000" -> 5000000, "500000.00" -> 500000
 */
export const parseRupiah = (val) => toIntegerRupiah(val);

export default {
  formatRupiah,
  parseRupiah
};
