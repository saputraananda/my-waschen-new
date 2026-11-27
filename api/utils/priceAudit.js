/**
 * Audit harga nota di server. Total dari klien tidak dipercaya begitu saja:
 * - Selalu ditolak: angka tidak valid / negatif, diskon melebihi subtotal.
 * - Selisih rumus & harga master: dicatat (mode log). Set PRICE_CHECK_MODE=enforce untuk menolak.
 * Rumus kasir (Transaction/index.jsx): grand = max(0, subtotal x (express ? 2 : 1) + parfum - Go-Green - diskon - promo member).
 * extrasNet = total parfum - total Go-Green, memberDiscount = promo member (dihitung server, utils/orderExtras.js).
 */
const TOLERANCE = 1; // rupiah, pembulatan

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};

export function priceCheckMode() {
  return String(process.env.PRICE_CHECK_MODE || 'log').toLowerCase() === 'enforce' ? 'enforce' : 'log';
}

export async function auditOrderPricing(connection, { items, subtotal, discountAmount, grandTotal, speedId, outletId, extrasNet = 0, memberDiscount = 0 }) {
  const fatal = [];
  const issues = [];

  const sub = num(subtotal || 0);
  const disc = num(discountAmount || 0);
  const grand = num(grandTotal || 0);
  if ([sub, disc, grand].some((n) => Number.isNaN(n) || n < 0)) {
    fatal.push('Subtotal, diskon, atau total tidak valid');
    return { fatal, issues };
  }

  const express = Number(speedId) === 2;
  const afterSpeed = sub * (express ? 2 : 1) + (num(extrasNet) || 0);
  if (disc > afterSpeed + TOLERANCE) fatal.push('Diskon melebihi subtotal');

  const expectedGrand = Math.max(0, afterSpeed - disc - (num(memberDiscount) || 0));
  if (Math.abs(expectedGrand - grand) > TOLERANCE) {
    issues.push(`total klien ${grand} != rumus ${expectedGrand}`);
  }

  const lineSum = (items || []).reduce((s, it) => s + (num(it.subtotal || it.effectiveSubtotal) || 0), 0);
  if (Math.abs(lineSum - sub) > TOLERANCE) issues.push(`subtotal ${sub} != jumlah baris ${lineSum}`);

  // Setiap baris wajib punya id layanan yang valid dan ada di master — tidak dilewati diam-diam.
  const rawIds = (items || []).map((it) => parseInt(it.serviceId || it.serviceDbId || it.id, 10));
  if (rawIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    fatal.push('Ada item tanpa id layanan yang valid');
    return { fatal, issues };
  }
  const ids = [...new Set(rawIds)];
  if (ids.length) {
    // Harga efektif outlet (override mst_service_outlet, jika kosong harga master).
    const [rows] = await connection.query(
      `SELECT s.id, COALESCE(so.price, s.price) AS price
       FROM mst_service s
       LEFT JOIN mst_service_outlet so ON so.service_id = s.id AND so.outlet_id = ?
       WHERE s.id IN (?)`,
      [Number(outletId) || 0, ids]
    );
    const priceOf = new Map(rows.map((r) => [Number(r.id), parseFloat(r.price) || 0]));
    const unknown = ids.filter((id) => !priceOf.has(id));
    if (unknown.length) {
      fatal.push(`Layanan tidak ditemukan: #${unknown.join(', #')}`);
      return { fatal, issues };
    }
    for (const it of items) {
      const id = parseInt(it.serviceId || it.serviceDbId || it.id, 10);
      const qty = num(it.qty) || 1;
      const line = num(it.subtotal || it.effectiveSubtotal) || 0;
      const min = priceOf.get(id) * qty;
      // Harga efektif boleh lebih besar (qty minimum), tidak boleh lebih kecil dari master.
      if (line + TOLERANCE < min) issues.push(`layanan ${id}: baris ${line} < master ${min}`);
    }
  }

  return { fatal, issues };
}
