import express from 'express';
import {
  getCustomers,
  getCustomerChurn,
  getCustomerById,
  createCustomer,
  updateCustomer,
  topupDeposit,
  getCustomerFavoriteServices
} from '../controllers/customer.controller.js';

const router = express.Router();

router.get('/', getCustomers);
router.get('/churn', getCustomerChurn);
router.get('/:id/favorite-services', getCustomerFavoriteServices);
router.get('/:id', getCustomerById);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.post('/:id/deposit', topupDeposit);

export default router;
