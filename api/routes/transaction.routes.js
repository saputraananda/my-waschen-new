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
  getRefundRequests,
  settlePaymentBatch,
  getPaymentBatchByNo,
  uploadPaymentProof,
  uploadItemPhotoDraft,
  uploadItemPhoto,
  ensureDigitalNotaAccess
} from '../controllers/transaction.controller.js';
import { uploadPaymentReceipt, uploadItemPhotoFile,uploadDeleteRequestAttachment, uploadRefundRequestAttachment, verifyUploadContents } from '../middleware/upload.js';
import { requirePosAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.post('/', createTransaction);
router.get('/', getTransactions);
router.post('/settle-batch', settlePaymentBatch);
router.get('/batch/:batchNo', getPaymentBatchByNo);
router.get('/refunds', getRefundRequests);
router.post('/:orderNo/digital-nota-access', ensureDigitalNotaAccess);
router.post('/:id/payment-proof', requirePosAuth, uploadPaymentReceipt, verifyUploadContents, uploadPaymentProof);
router.post('/item-photo', requirePosAuth, uploadItemPhotoFile, verifyUploadContents, uploadItemPhotoDraft);
router.post('/:id/items/:itemId/photo', requirePosAuth, uploadItemPhotoFile, verifyUploadContents, uploadItemPhoto);
router.get('/:orderNo', getTransactionDetail);
router.patch('/:id/items/:itemId/status', updateItemWorkStatus);
router.put('/:id/items/:itemId/status', updateItemWorkStatus);
router.patch('/:id/fulfillment', updateFulfillment);
router.put('/:id/fulfillment', updateFulfillment);
router.patch('/:id/status', updateWorkStatus);
router.put('/:id/status', updateWorkStatus);
router.patch('/:id/pay', markTransactionAsPaid);
router.put('/:id/pay', markTransactionAsPaid);
router.patch('/:id/request-delete', requirePosAuth, uploadDeleteRequestAttachment, verifyUploadContents, requestDeleteTransaction);
router.patch('/:id/request-refund', requirePosAuth, uploadRefundRequestAttachment, verifyUploadContents, requestRefundTransaction);

export default router;
