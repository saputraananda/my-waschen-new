import express from 'express';
import {
  getPaymentLogs,
  updateTransactionPayment,
  uploadPaymentProof,
  uploadPaymentProofMiddleware
} from '../controllers/history.controller.js';

const router = express.Router();

router.get('/transactions/:id/payments', getPaymentLogs);
router.patch('/transactions/:id/payment', updateTransactionPayment);
router.put('/transactions/:id/payment', updateTransactionPayment);
router.post('/transactions/:id/payment-proof', uploadPaymentProofMiddleware, uploadPaymentProof);

export default router;
