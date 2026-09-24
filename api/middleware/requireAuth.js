import jwt from 'jsonwebtoken';

/** Sesi POS. Token sama dengan login, bukan identitas dari body. */
export function requirePosAuth(req, res, next) {
  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid' });
  }
  try {
    req.auth = jwt.verify(token, process.env.SESSION_SECRET || 'waschensecret');
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid' });
  }
}
