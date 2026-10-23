import { Router } from 'express';
import {
  getCurrentShift,
  getPreviousClosing,
  openShift,
  getShiftTransactions,
  verifyShiftTxn,
  closeShift,
  getDailyReport,
  verifyPin,
  resumeShift
} from '../controllers/shift.controller.js';

const router = Router();

router.get('/current', getCurrentShift);
router.get('/previous-closing', getPreviousClosing);
router.get('/daily-report', getDailyReport);
router.post('/open', openShift);
router.post('/verify-pin', verifyPin);
router.post('/:id/resume', resumeShift);
router.get('/:id/transactions', getShiftTransactions);
router.post('/:id/verify-txn', verifyShiftTxn);
router.post('/:id/close', closeShift);

export default router;
