/**
 * Audit harga nota di server. Total dari klien tidak dipercaya begitu saja:
 * - Selalu ditolak: angka tidak valid / negatif, diskon melebihi subtotal.
 * - Selisih rumus & harga master: dicatat (mode log). Set PRICE_CHECK_MODE=enforce untuk menolak.
 * Rumus kasir (Transaction/index.jsx): grand = max(0, subtotal x (express ? 2 : 1) - diskon).
 */
const TOLERANCE = 1; // rupiah, pembulatan

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};

export function priceCheckMode() {
  return String(process.env.PRICE_CHECK_MODE || 'log').toLowerCase() === 'enforce' ? 'enforce' : 'log';
}

export async function auditOrderPricing(connection, { items, subtotal, discountAmount, grandTotal, speedId }) {
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
  const afterSpeed = sub * (express ? 2 : 1);
  if (disc > afterSpeed + TOLERANCE) fatal.push('Diskon melebihi subtotal');

  const expectedGrand = Math.max(0, afterSpeed - disc);
  if (Math.abs(expectedGrand - grand) > TOLERANCE) {
    issues.push(`total klien ${grand} != rumus ${expectedGrand}`);
  }

  const lineSum = (items || []).reduce((s, it) => s + (num(it.subtotal || it.effectiveSubtotal) || 0), 0);
  if (Math.abs(lineSum - sub) > TOLERANCE) issues.push(`subtotal ${sub} != jumlah baris ${lineSum}`);

  const ids = [...new Set((items || []).map((it) => parseInt(it.serviceId || it.serviceDbId || it.id, 10)).filter(Boolean))];
  if (ids.length) {
    const [rows] = await connection.query('SELECT id, price FROM mst_service WHERE id IN (?)', [ids]);
    const priceOf = new Map(rows.map((r) => [r.id, parseFloat(r.price) || 0]));
    for (const it of items) {
      const id = parseInt(it.serviceId || it.serviceDbId || it.id, 10);
      if (!priceOf.has(id)) continue;
      const qty = num(it.qty) || 1;
      const line = num(it.subtotal || it.effectiveSubtotal) || 0;
      const min = priceOf.get(id) * qty;
      // Harga efektif boleh lebih besar (qty minimum), tidak boleh lebih kecil dari master.
      if (line + TOLERANCE < min) issues.push(`layanan ${id}: baris ${line} < master ${min}`);
    }
  }

  return { fatal, issues };
}
