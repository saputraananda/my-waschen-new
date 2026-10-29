import jwt from 'jsonwebtoken';
import { getSessionSecret } from '../utils/sessionSecret.js';

/** Sesi POS. Token sama dengan login, bukan identitas dari body. */
export function requirePosAuth(req, res, next) {
  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid' });
  }
  try {
    req.auth = jwt.verify(token, getSessionSecret());
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid' });
  }
}
