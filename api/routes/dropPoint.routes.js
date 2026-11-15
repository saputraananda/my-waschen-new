import express from 'express';
import {
  getDropPointList,
  getBranchOutlets,
  getDropPointItems,
  assignDropPointItems
} from '../controllers/dropPointDistribution.controller.js';
import { requirePosAuth } from '../middleware/requireAuth.js';
import { mainPool } from '../db/pool.js';
import { isDropPointOutlet } from '../utils/dropPointOutlet.js';

const router = express.Router();

/**
 * Distribusi Drop Point hanya untuk Manajemen (company_id = 1) atau staf yang sedang
 * bekerja di outlet Drop Point (dikirim client lewat header X-Active-Outlet-Id).
 *
 * req.dropPointScope.outletId = drop point yang boleh diakses:
 *   - Staf: selalu outlet drop point yang sedang aktif di header (tidak bisa melihat drop point lain).
 *   - Manajemen: drop point yang dipilih (query/body dropPointOutletId), divalidasi di controller.
 */
async function requireDropPointAccess(req, res, next) {
  try {
    const [rows] = await mainPool.query(
      `SELECT e.company_id
       FROM users u
       LEFT JOIN mst_employee e ON LOWER(TRIM(e.email)) = LOWER(TRIM(u.email))
       WHERE u.id = ? LIMIT 1`,
      [req.auth?.userId]
    );
    if (Number(rows[0]?.company_id) === 1) {
      req.dropPointScope = { isManagement: true, outletId: null };
      return next();
    }
    const headerOutletId = Number(req.headers['x-active-outlet-id']) || null;
    if (await isDropPointOutlet(headerOutletId)) {
      req.dropPointScope = { isManagement: false, outletId: headerOutletId };
      return next();
    }
    return res.status(403).json({ success: false, message: 'Menu ini hanya untuk Manajemen atau staf yang bertugas di outlet Drop Point.' });
  } catch (error) {
    console.error('requireDropPointAccess:', error);
    return res.status(500).json({ success: false, message: 'Gagal memeriksa akses Drop Point' });
  }
}

router.use(requirePosAuth, requireDropPointAccess);
router.get('/list', getDropPointList);
router.get('/outlets', getBranchOutlets);
router.get('/items', getDropPointItems);
router.post('/assign', assignDropPointItems);

export default router;
