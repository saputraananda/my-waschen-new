import express from 'express';
import {
  createTransaction,
  getTransactions,
  getTransactionDetail,
  updateWorkStatus,
  markTransactionAsPaid,
  requestDeleteTransaction
} from '../controllers/transaction.controller.js';

const router = express.Router();

router.post('/', createTransaction);
router.get('/', getTransactions);
router.get('/:orderNo', getTransactionDetail);
router.patch('/:id/status', updateWorkStatus);
router.patch('/:id/pay', markTransactionAsPaid);
router.patch('/:id/request-delete', requestDeleteTransaction);

export default router;
