/**
 * Phase 20 — komponen harga di luar harga layanan, dihitung ulang di server dari master:
 * - Parfum per item (mst_parfume.price). Layanan outlet dengan is_special_parfume → Rp0.
 * - Kemasan Go-Green per item (mst_service_outlet.go_green_discount), flat per baris item.
 * - Promo member otomatis (mst_promo.is_auto): tier member cocok, outlet cocok, bayar
 *   Potong Saldo Member (bila requires_member_balance), hanya layanan di mst_promo_service
 *   (kosong = semua). Dipotong SETELAH promo manual, dari sisa tagihan.
 *
 * Rumus nota (sama dengan Transaction/index.jsx):
 *   base   = subtotal layanan × (express ? 2 : 1) + total parfum − total Go-Green
 *   grand  = max(0, base − promo manual − promo member)
 */

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const itemServiceId = (it) => parseInt(it.serviceId || it.serviceDbId || it.id, 10);
const itemLine = (it) => num(it.subtotal || it.effectiveSubtotal);

/** Metode bayar memotong saldo member? (sama dengan customerDeposit.applyDepositOnPayment) */
export async function isMemberBalanceMethod(conn, paymentMethod) {
  if (!paymentMethod) return false;
  if (/saldo member/i.test(paymentMethod)) return true;
  const [rows] = await conn.query(
    `SELECT requires_member_balance FROM mst_payment_method
     WHERE is_active = 1 AND (name = ? OR label = ? OR code = ?) LIMIT 1`,
    [paymentMethod, paymentMethod, String(paymentMethod).toUpperCase()]
  );
  return Number(rows[0]?.requires_member_balance) === 1;
}

/** Tier membership aktif customer (Gold/Platinum/Diamond) atau null. */
export async function getActiveMemberTier(conn, customerId) {
  if (!customerId) return null;
  const [rows] = await conn.query(
    `SELECT mpkg.tier
     FROM mst_customer c
     JOIN tr_membership m ON m.id = c.active_membership_id AND m.status = 'Active' AND m.end_date >= CURDATE()
     JOIN mst_membership_package mpkg ON mpkg.id = m.package_id
     WHERE c.id = ? LIMIT 1`,
    [customerId]
  );
  return rows[0]?.tier || null;
}

/**
 * Hitung parfum & Go-Green per item. Mengembalikan baris yang sudah di-resolve (urutan sama
 * dengan `items`) beserta totalnya.
 */
export async function resolveItemExtras(conn, { outletId, items }) {
  const list = Array.isArray(items) ? items : [];
  const parfumeIds = [...new Set(list.map((it) => parseInt(it.parfumeId, 10)).filter((n) => n > 0))];
  const serviceIds = [...new Set(list.map(itemServiceId).filter((n) => n > 0))];

  const [[parfRows], [soRows]] = await Promise.all([
    parfumeIds.length
      ? conn.query(
        `SELECT id, name, price FROM mst_parfume
         WHERE id IN (?) AND is_active = 1 AND (outlet_id IS NULL OR outlet_id = ?)`,
        [parfumeIds, Number(outletId) || 0]
      )
      : [[]],
    serviceIds.length
      ? conn.query(
        `SELECT service_id, is_special_parfume, go_green_discount
         FROM mst_service_outlet WHERE outlet_id = ? AND service_id IN (?)`,
        [Number(outletId) || 0, serviceIds]
      )
      : [[]]
  ]);
  const parfOf = new Map(parfRows.map((r) => [Number(r.id), r]));
  const soOf = new Map(soRows.map((r) => [Number(r.service_id), r]));

  let parfumeTotal = 0;
  let goGreenTotal = 0;
  const lines = list.map((it) => {
    const so = soOf.get(itemServiceId(it));
    const parf = parfOf.get(parseInt(it.parfumeId, 10)) || null;
    const special = Number(so?.is_special_parfume) === 1;
    const parfumePrice = parf && !special ? num(parf.price) : 0;
    const ggAvail = num(so?.go_green_discount);
    const goGreenDiscount = it.isGoGreen && ggAvail > 0 ? ggAvail : 0;
    parfumeTotal += parfumePrice;
    goGreenTotal += goGreenDiscount;
    return {
      parfumeId: parf ? Number(parf.id) : null,
      parfumeName: parf ? parf.name : null,
      parfumePrice,
      isGoGreen: goGreenDiscount > 0,
      goGreenDiscount
    };
  });
  return { lines, parfumeTotal, goGreenTotal };
}

/**
 * Promo member otomatis terbaik untuk nota ini. `remaining` = sisa tagihan setelah promo manual.
 * Mengembalikan { promo, amount } atau { promo: null, amount: 0 }.
 */
export async function resolveMemberPromo(conn, {
  outletId, customerId, items, lines, expressMultiplier, paymentMethod, paymentStatus, remaining
}) {
  const none = { promo: null, amount: 0 };
  if (paymentStatus !== 'Lunas' || remaining <= 0) return none;
  const tier = await getActiveMemberTier(conn, customerId);
  if (!tier) return none;
  const [promos] = await conn.query(
    `SELECT * FROM mst_promo
     WHERE is_active = 1 AND is_auto = 1 AND discount_type IN ('percentage','nominal')
       AND (outlet_id IS NULL OR outlet_id = ?) AND FIND_IN_SET(?, member_tiers) > 0`,
    [Number(outletId) || 0, tier]
  );
  if (!promos.length) return none;
  const balanceMethod = await isMemberBalanceMethod(conn, paymentMethod);
  const [svcRows] = await conn.query('SELECT promo_id, service_id FROM mst_promo_service WHERE promo_id IN (?)', [promos.map((p) => p.id)]);
  const svcOf = new Map();
  svcRows.forEach((r) => {
    if (!svcOf.has(r.promo_id)) svcOf.set(r.promo_id, new Set());
    svcOf.get(r.promo_id).add(Number(r.service_id));
  });

  let best = none;
  for (const p of promos) {
    if (Number(p.requires_member_balance) === 1 && !balanceMethod) continue;
    const scope = svcOf.get(p.id);
    // Dasar promo = nilai baris layanan yang masuk daftar (termasuk express, parfum, Go-Green).
    const eligible = (items || []).reduce((s, it, i) => {
      if (scope && !scope.has(itemServiceId(it))) return s;
      const l = lines[i] || {};
      return s + itemLine(it) * expressMultiplier + (l.parfumePrice || 0) - (l.goGreenDiscount || 0);
    }, 0);
    const basis = Math.max(0, Math.min(eligible, remaining));
    if (basis <= 0) continue;
    let amount = p.discount_type === 'percentage'
      ? Math.round((basis * num(p.discount_value)) / 100)
      : Math.min(basis, num(p.discount_value));
    if (num(p.max_discount) > 0) amount = Math.min(amount, num(p.max_discount));
    if (amount > best.amount) best = { promo: p, amount };
  }
  return best;
}
