import express from 'express';
import {
  createTransaction,
  getTransactions,
  getTransactionDetail,
  updateWorkStatus,
  updateItemWorkStatus,
  updateFulfillment,
  markTransactionAsPaid,
  requestDeleteTransaction,
  requestRefundTransaction,
  settlePaymentBatch,
  getPaymentBatchByNo,
  uploadPaymentProof,
  ensureDigitalNotaAccess
} from '../controllers/transaction.controller.js';
import { uploadPaymentReceipt } from '../middleware/upload.js';

const router = express.Router();

router.post('/', createTransaction);
router.get('/', getTransactions);
router.post('/settle-batch', settlePaymentBatch);
router.get('/batch/:batchNo', getPaymentBatchByNo);
router.post('/:orderNo/digital-nota-access', ensureDigitalNotaAccess);
router.post('/:id/payment-proof', uploadPaymentReceipt, uploadPaymentProof);
router.get('/:orderNo', getTransactionDetail);
router.patch('/:id/items/:itemId/status', updateItemWorkStatus);
router.put('/:id/items/:itemId/status', updateItemWorkStatus);
router.patch('/:id/fulfillment', updateFulfillment);
router.put('/:id/fulfillment', updateFulfillment);
router.patch('/:id/status', updateWorkStatus);
router.put('/:id/status', updateWorkStatus);
router.patch('/:id/pay', markTransactionAsPaid);
router.put('/:id/pay', markTransactionAsPaid);
router.patch('/:id/request-delete', requestDeleteTransaction);
router.patch('/:id/request-refund', requestRefundTransaction);

export default router;
