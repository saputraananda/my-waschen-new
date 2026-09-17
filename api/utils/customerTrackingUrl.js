/**
 * Base URL Waschen Customer (portal lacak cucian).
 * Server: CUSTOMER_APP_URL
 * Jangan pakai origin POS — link nota digital harus ke app pelanggan.
 */
export function getCustomerAppOrigin() {
  const raw = String(process.env.CUSTOMER_APP_URL || process.env.VITE_CUSTOMER_APP_URL || '').trim();
  if (raw) return raw.replace(/\/+$/, '');
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:8000';
  return '';
}

export function buildCustomerTrackingUrl(orderNo) {
  const origin = getCustomerAppOrigin();
  const no = String(orderNo || '').trim();
  if (!origin || !no) return '';
  return `${origin}/tracking?trackingNo=${encodeURIComponent(no)}`;
}
