import express from 'express';
import { getDashboardStats, getRevenueSummary } from '../controllers/dashboard.controller.js';

const router = express.Router();

router.get('/stats', getDashboardStats);
router.get('/revenue', getRevenueSummary);

export default router;
