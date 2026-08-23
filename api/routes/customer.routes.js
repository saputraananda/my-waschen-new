import express from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  topupDeposit
} from '../controllers/customer.controller.js';

const router = express.Router();

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.post('/:id/deposit', topupDeposit);

export default router;
