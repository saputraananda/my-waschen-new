/** Secret JWT sesi POS. Wajib ada di env: tanpa nilai bawaan agar token tidak bisa dipalsukan. */
export function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 8) {
    throw new Error('SESSION_SECRET belum diset (minimal 8 karakter) di environment server');
  }
  return secret;
}
