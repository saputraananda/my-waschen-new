import express from 'express';
import { getEventList, getBranchOutlets, getEventItems, assignEventItems } from '../controllers/eventDistribution.controller.js';
import { requirePosAuth } from '../middleware/requireAuth.js';
import { mainPool } from '../db/pool.js';
import { isEventOutlet } from '../utils/eventOutlet.js';

const router = express.Router();

/**
 * Distribusi Event hanya untuk Manajemen (company_id = 1) atau staf yang sedang
 * bekerja di outlet Event (dikirim client lewat header X-Active-Outlet-Id).
 *
 * req.eventScope.outletId = event yang boleh diakses:
 *   - Staf: selalu outlet event yang sedang aktif di header (tidak bisa melihat event lain).
 *   - Manajemen: event yang dipilih (query/body eventOutletId), divalidasi di controller.
 */
async function requireEventAccess(req, res, next) {
  try {
    const [rows] = await mainPool.query(
      `SELECT e.company_id
       FROM users u
       LEFT JOIN mst_employee e ON LOWER(TRIM(e.email)) = LOWER(TRIM(u.email))
       WHERE u.id = ? LIMIT 1`,
      [req.auth?.userId]
    );
    if (Number(rows[0]?.company_id) === 1) {
      req.eventScope = { isManagement: true, outletId: null };
      return next();
    }
    const headerOutletId = Number(req.headers['x-active-outlet-id']) || null;
    if (await isEventOutlet(headerOutletId)) {
      req.eventScope = { isManagement: false, outletId: headerOutletId };
      return next();
    }
    return res.status(403).json({ success: false, message: 'Menu ini hanya untuk Manajemen atau staf yang bertugas di outlet Event.' });
  } catch (error) {
    console.error('requireEventAccess:', error);
    return res.status(500).json({ success: false, message: 'Gagal memeriksa akses event' });
  }
}

router.use(requirePosAuth, requireEventAccess);
router.get('/list', getEventList);
router.get('/outlets', getBranchOutlets);
router.get('/items', getEventItems);
router.post('/assign', assignEventItems);

export default router;
