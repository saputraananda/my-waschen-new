import express from 'express';
import {
  getPaymentLogs,
  updateTransactionPayment,
  uploadPaymentProof,
  deletePaymentProof,
  uploadPaymentProofMiddleware
} from '../controllers/history.controller.js';
import { verifyUploadContents } from '../middleware/upload.js';
import { requirePosAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.get('/transactions/:id/payments', getPaymentLogs);
router.patch('/transactions/:id/payment', updateTransactionPayment);
router.put('/transactions/:id/payment', updateTransactionPayment);
router.post('/transactions/:id/payment-proof', requirePosAuth, uploadPaymentProofMiddleware, verifyUploadContents, uploadPaymentProof);
router.delete('/transactions/:id/payment-proof', requirePosAuth, deletePaymentProof);

export default router;
