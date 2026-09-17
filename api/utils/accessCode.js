import crypto from 'crypto';

/** Kode akses nota digital: 4 digit (0000–9999). */
export function generateAccessCode() {
  return String(crypto.randomInt(0, 10000)).padStart(4, '0');
}

export function normalizeAccessCode(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 4) return '';
  return digits;
}

/** Bandingkan kode secara timing-safe. */
export function accessCodesMatch(stored, input) {
  const a = normalizeAccessCode(stored);
  const b = normalizeAccessCode(input);
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}
