/**
 * Paket membership (mst_membership_package).
 * Paket umum (outlet_id NULL): bonus saldo Gold Rp25.000 / Diamond Rp50.000.
 * Paket khusus outlet (mis. Transyogi Gold/Platinum/Diamond): tanpa bonus saldo,
 * benefit = promo member otomatis outlet itu (lihat api/controllers/membership.controller.js).
 */
export const isOutletPackage = (pkg) => pkg?.outlet_id != null && pkg?.outlet_id !== '';

export function packageBonus(pkg) {
  if (!pkg || isOutletPackage(pkg)) return 0;
  return String(pkg.tier || '').toLowerCase().includes('diamond') ? 50000 : 25000;
}

/** Promo member otomatis yang berlaku untuk tier ini (dari /api/masters?outlet_id=). */
export function memberPromosForTier(promos, tier) {
  return (promos || []).filter((p) => Number(p.is_auto) === 1
    && String(p.member_tiers || '').split(',').map((t) => t.trim()).includes(tier));
}
