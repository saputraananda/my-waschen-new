/**
 * Rincian harga nota: harga asli → biaya express → promo → total bayar.
 * Satu sumber untuk nota cetak, nota digital (WA) dan halaman rincian.
 *
 * Kolom tr_transaction:
 *   subtotal        = jumlah harga item (sebelum express)
 *   speed_surcharge = tambahan biaya express
 *   discount_amount = potongan promo (manual + member)
 *   discount_notes  = nama promo ("Manual + Member")
 *   member_discount_amount = bagian promo member
 *   grand_total     = subtotal + speed_surcharge + parfum − Go-Green − discount_amount
 *   (parfum & Go-Green per item: tr_transaction_detail.parfume_price / go_green_discount)
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

/**
 * Phase 20 — kolom tambahan per item (tr_transaction_detail): parfum berbayar & Go-Green.
 * Dipakai semua mapper baris DB → item nota supaya bentuknya seragam.
 */
export function itemExtrasFromRow(it) {
  return {
    parfumeId: it?.parfume_id ?? null,
    parfumeName: it?.parfume_name || null,
    parfumePrice: parseFloat(it?.parfume_price) || 0,
    isGoGreen: Number(it?.is_go_green) === 1,
    goGreenDiscount: parseFloat(it?.go_green_discount) || 0
  };
}

/** Kolom tambahan per nota (tr_transaction): promo member otomatis. */
export function orderExtrasFromRow(raw) {
  return { memberDiscountAmount: parseFloat(raw?.member_discount_amount) || 0 };
}

/** Teks parfum per item, mis. "Parfum HMNS (+Rp 3.000)". Kosong bila item tanpa parfum per item. */
export function itemParfumeLabel(it) {
  if (!it?.parfumeName) return '';
  const price = Number(it.parfumePrice) || 0;
  return price > 0 ? `${it.parfumeName} (+Rp ${price.toLocaleString('id-ID')})` : it.parfumeName;
}

/** Nota dengan parfum per item (Transyogi) → baris "Parfum :" per nota tidak dipakai. */
export function hasItemParfume(items) {
  return (items || []).some((it) => it?.parfumeName);
}

const sumItems = (items, key) => (items || []).reduce((s, it) => s + (Number(it?.[key]) || 0), 0);

export function getNotaPricing(receipt) {
  const grand = Math.max(0, Number(receipt?.grandTotal) || 0);
  // discountAmount = total potongan (promo manual + promo member)
  const discount = Math.max(0, Number(receipt?.discountAmount) || 0);
  const memberDiscount = Math.min(discount, Math.max(0, Number(receipt?.memberDiscountAmount) || 0));
  const manualDiscount = discount - memberDiscount;
  const parfumeTotal = Math.max(0, receipt?.parfumeTotal != null
    ? Number(receipt.parfumeTotal) || 0
    : sumItems(receipt?.items, 'parfumePrice'));
  const goGreenTotal = Math.max(0, receipt?.goGreenTotal != null
    ? Number(receipt.goGreenTotal) || 0
    : sumItems(receipt?.items, 'goGreenDiscount'));
  const extrasNet = parfumeTotal - goGreenTotal;
  let surcharge = Math.max(0, Number(receipt?.speedSurcharge) || 0);
  let subtotal = Math.max(0, Number(receipt?.subtotal) || 0);
  // Nota express lama: speed_surcharge tersimpan 0 → turunkan dari total
  if (!surcharge && receipt?.isExpress && subtotal > 0) {
    const derived = grand + discount - extrasNet - subtotal;
    if (derived > 1) surcharge = derived;
  }
  // Data lama tanpa subtotal: turunkan dari total + potongan
  if (!subtotal) subtotal = Math.max(0, grand + discount - extrasNet - surcharge);

  // Harga normal = layanan + express + parfum − Go-Green (dasar perhitungan promo)
  const original = subtotal + surcharge + extrasNet;
  const hasPromo = discount > 0;
  // discount_notes = "Promo manual + Promo member" (lihat createTransaction)
  const names = String(receipt?.promoName ?? '').split(' + ').map(cleanPromoName).filter(Boolean);
  const memberPromoName = memberDiscount > 0 ? (cleanPromoName(receipt?.memberPromoName) || names.pop() || 'Promo Member') : '';
  const manualNames = memberDiscount > 0 && !receipt?.memberPromoName ? names : names.filter((n) => n !== memberPromoName);
  const promoName = manualDiscount > 0 ? (manualNames.join(' + ') || 'Diskon') : '';

  return {
    subtotal,
    surcharge,
    parfumeTotal,
    goGreenTotal,
    original,
    discount,
    manualDiscount,
    memberDiscount,
    grand,
    promoName,
    memberPromoName,
    hasPromo,
    hasManualPromo: manualDiscount > 0,
    hasMemberPromo: memberDiscount > 0,
    hasParfume: parfumeTotal > 0,
    hasGoGreen: goGreenTotal > 0,
    // Total hemat untuk customer = semua promo + Go-Green
    saved: discount + goGreenTotal,
    isExpress: Boolean(receipt?.isExpress) || surcharge > 0,
    hasSurcharge: surcharge > 0,
    showBreakdown: hasPromo || surcharge > 0 || parfumeTotal > 0 || goGreenTotal > 0
  };
}
