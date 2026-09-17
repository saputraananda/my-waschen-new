/**
 * Base URL Waschen Customer untuk link tracking nota digital.
 * Wajib set VITE_CUSTOMER_APP_URL di production agar link tidak salah/ke POS.
 */
export function getCustomerAppOrigin() {
  const fromEnv = String(import.meta.env.VITE_CUSTOMER_APP_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return 'http://localhost:8000';
  return '';
}

/**
 * Link lacak cucian — HANYA nomor nota di query (kode akses tidak ikut di URL).
 * @returns {string} URL absolut, atau '' jika origin/orderNo tidak valid
 */
export function buildCustomerTrackingUrl(orderNo) {
  const origin = getCustomerAppOrigin();
  const no = String(orderNo || '').trim();
  if (!origin || !no) return '';
  try {
    const url = new URL('/tracking', origin);
    url.searchParams.set('trackingNo', no);
    return url.toString();
  } catch {
    return '';
  }
}

/** Nilai QR cetak/struk = URL tracking customer (tanpa kode akses). */
export function getCustomerTrackingQrValue(receiptOrOrderNo) {
  const orderNo = typeof receiptOrOrderNo === 'string'
    ? receiptOrOrderNo
    : (receiptOrOrderNo?.id || receiptOrOrderNo?.orderNo || receiptOrOrderNo?.order_no || '');
  return buildCustomerTrackingUrl(orderNo);
}
