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
  resumeShift,
  getPendingDeposit,
  uploadDepositProof
} from '../controllers/shift.controller.js';
import { uploadDepositReport } from '../middleware/upload.js';

const router = Router();

router.get('/current', getCurrentShift);
router.get('/previous-closing', getPreviousClosing);
router.get('/pending-deposit', getPendingDeposit);
router.get('/daily-report', getDailyReport);
router.post('/open', openShift);
router.post('/verify-pin', verifyPin);
router.post('/:id/resume', resumeShift);
router.get('/:id/transactions', getShiftTransactions);
router.post('/:id/verify-txn', verifyShiftTxn);
router.post('/:id/close', closeShift);
router.post('/:id/deposit-proof', uploadDepositReport, uploadDepositProof);

export default router;
