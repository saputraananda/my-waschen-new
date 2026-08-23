/**
 * Helper utility for formatting numbers into Indonesian Rupiah format with thousand separators
 * Example: 50000 -> "50.000", 5000000 -> "5.000.000"
 */
export const formatRupiah = (val, withPrefix = false) => {
  if (val === null || val === undefined || val === '') return '';
  
  // Strip non-numeric characters
  const cleanStr = String(val).replace(/[^0-9]/g, '');
  if (!cleanStr) return '';

  const num = parseInt(cleanStr, 10);
  const formatted = num.toLocaleString('id-ID');

  return withPrefix ? `Rp ${formatted}` : formatted;
};

/**
 * Utility to parse formatted Rupiah string back to raw number
 * Example: "5.000.000" -> 5000000
 */
export const parseRupiah = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const cleanStr = String(val).replace(/[^0-9]/g, '');
  return cleanStr ? parseInt(cleanStr, 10) : 0;
};

export default {
  formatRupiah,
  parseRupiah
};
