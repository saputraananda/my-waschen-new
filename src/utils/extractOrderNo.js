/** Nomor nota dari QR/barcode. QR POS = URL ?trackingNo= ; fallback WS- / WL... */
export const extractOrderNo = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return '';

  try {
    const url = new URL(text);
    const tracking =
      url.searchParams.get('trackingNo') ||
      url.searchParams.get('tracking_no') ||
      url.searchParams.get('orderNo') ||
      url.searchParams.get('order_no') ||
      url.searchParams.get('nota') ||
      url.searchParams.get('barcode');
    if (tracking) return decodeURIComponent(tracking).trim();
  } catch {
    // bukan URL absolut
  }

  const qsMatch = text.match(
    /[?&#](?:trackingNo|tracking_no|orderNo|order_no|nota|barcode)=([^&#]+)/i
  );
  if (qsMatch?.[1]) {
    try {
      return decodeURIComponent(qsMatch[1]).trim();
    } catch {
      return qsMatch[1].trim();
    }
  }

  const wsMatch = text.match(/WS-\d+/i);
  if (wsMatch) return wsMatch[0].toUpperCase();

  const wlMatch = text.match(/\bWL[A-Z]{0,4}\d{8,}\b/i);
  if (wlMatch) return wlMatch[0].toUpperCase();

  return text;
};
