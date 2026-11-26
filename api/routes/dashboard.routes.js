import express from 'express';
import { getDashboardStats, getRevenueSummary, getRevenuePayments, getReceivables } from '../controllers/dashboard.controller.js';

const router = express.Router();

router.get('/stats', getDashboardStats);
router.get('/revenue', getRevenueSummary);
router.get('/payments', getRevenuePayments);
router.get('/receivables', getReceivables);

export default router;
