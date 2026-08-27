import express from 'express';
import {
  createTransaction,
  getTransactions,
  getTransactionDetail,
  updateWorkStatus,
  updateItemWorkStatus,
  markTransactionAsPaid,
  requestDeleteTransaction,
  settlePaymentBatch,
  getPaymentBatchByNo,
  uploadPaymentProof
} from '../controllers/transaction.controller.js';
import { uploadPaymentReceipt } from '../middleware/upload.js';

const router = express.Router();

router.post('/', createTransaction);
router.get('/', getTransactions);
router.post('/settle-batch', settlePaymentBatch);
router.get('/batch/:batchNo', getPaymentBatchByNo);
router.post('/:id/payment-proof', uploadPaymentReceipt, uploadPaymentProof);
router.get('/:orderNo', getTransactionDetail);
router.patch('/:id/items/:itemId/status', updateItemWorkStatus);
router.put('/:id/items/:itemId/status', updateItemWorkStatus);
router.patch('/:id/status', updateWorkStatus);
router.put('/:id/status', updateWorkStatus);
router.patch('/:id/pay', markTransactionAsPaid);
router.put('/:id/pay', markTransactionAsPaid);
router.patch('/:id/request-delete', requestDeleteTransaction);

export default router;
