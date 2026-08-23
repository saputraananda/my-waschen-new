import express from 'express';
import { getTargetRevenue } from '../../controllers/additional/target.controller.js';

const router = express.Router();

// GET /api/target - Ambil target omset dari mst_target_waschen
router.get('/', getTargetRevenue);

export default router;
