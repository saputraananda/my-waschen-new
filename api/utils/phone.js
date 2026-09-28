/**
 * Normalisasi nomor HP Indonesia ke format 08xxxxxxxxxx.
 * 6287770597000 / 87770597000 / 087770597000 -> 087770597000
 * Nomor luar negeri ditulis dengan "+" (selain +62) dipertahankan: "+61 421-620-240" -> +61421620240
 */
export function normalizePhone(input) {
  if (input == null) return '';
  let digits = String(input).replace(/\D/g, '');
  if (!digits) return '';
  if (String(input).trim().startsWith('+') && !digits.startsWith('62')) return `+${digits}`;
  if (digits.startsWith('62')) digits = `0${digits.slice(2)}`;
  if (digits.startsWith('8')) digits = `0${digits}`;
  if (!digits.startsWith('0') && digits.length >= 9) digits = `0${digits}`;
  return digits;
}

export function composeFullAddress({
  address,
  block,
  houseNumber,
  district,
  subDistrict,
  city,
  postalCode
} = {}) {
  const parts = [];
  if (address) parts.push(String(address).trim());
  if (block) parts.push(`Blok ${String(block).trim()}`);
  if (houseNumber) parts.push(`No. ${String(houseNumber).trim()}`);
  if (subDistrict) parts.push(String(subDistrict).trim());
  if (district) parts.push(String(district).trim());
  if (city) parts.push(String(city).trim());
  if (postalCode) parts.push(String(postalCode).trim());
  return parts.filter(Boolean).join(', ');
}

export function hasCustomerAddress(customer) {
  const full = String(customer?.full_address || customer?.fullAddress || '').trim();
  const short = String(customer?.address || '').trim();
  if (full && full !== '-') return true;
  if (short && short !== '-') return true;
  return false;
}
