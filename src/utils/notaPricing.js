/**
 * Rincian harga nota: harga asli → biaya express → promo → total bayar.
 * Satu sumber untuk nota cetak, nota digital (WA) dan halaman rincian.
 *
 * Kolom tr_transaction:
 *   subtotal        = jumlah harga item (sebelum express)
 *   speed_surcharge = tambahan biaya express
 *   discount_amount = potongan promo
 *   discount_notes  = nama promo
 *   grand_total     = subtotal + speed_surcharge - discount_amount
 */

const NO_PROMO = /^(none|tanpa promo|-)$/i;

export function cleanPromoName(name) {
  const s = String(name ?? '').trim();
  if (!s || NO_PROMO.test(s)) return '';
  return s;
}

/** speed_id 2 = Express (mst_service_speed, harga x2) */
export const EXPRESS_SPEED_ID = 2;

/** Deteksi nota express dari baris DB (speed_surcharge lama sering tersimpan 0). */
export function isExpressRow(raw) {
  if (!raw) return false;
  return Number(raw.speed_id) === EXPRESS_SPEED_ID
    || Number(raw.speed_surcharge) > 0
    || /express|kilat/i.test(String(raw.speed_name || ''));
}

export function getNotaPricing(receipt) {
  const grand = Math.max(0, Number(receipt?.grandTotal) || 0);
  const discount = Math.max(0, Number(receipt?.discountAmount) || 0);
  let surcharge = Math.max(0, Number(receipt?.speedSurcharge) || 0);
  let subtotal = Math.max(0, Number(receipt?.subtotal) || 0);
  // Nota express lama: speed_surcharge tersimpan 0 → turunkan dari total
  if (!surcharge && receipt?.isExpress && subtotal > 0) {
    const derived = grand + discount - subtotal;
    if (derived > 1) surcharge = derived;
  }
  // Data lama tanpa subtotal: turunkan dari total + potongan
  if (!subtotal) subtotal = Math.max(0, grand + discount - surcharge);

  const original = subtotal + surcharge;
  const hasPromo = discount > 0;
  const promoName = hasPromo ? (cleanPromoName(receipt?.promoName) || 'Diskon') : '';

  return {
    subtotal,
    surcharge,
    original,
    discount,
    grand,
    promoName,
    hasPromo,
    isExpress: Boolean(receipt?.isExpress) || surcharge > 0,
    hasSurcharge: surcharge > 0,
    showBreakdown: hasPromo || surcharge > 0
  };
}
