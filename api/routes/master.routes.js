import express from 'express';
import {
  getAllMasters,
  getOutlets,
  getTargetRevenue,
  getPaymentMethods,
  getCustomerSources,
  getPettyCashCategories,
  getPromos,
  getCustomerTiers,
  getWorkStatuses
} from '../controllers/master.controller.js';

const router = express.Router();

router.get('/', getAllMasters);
router.get('/outlets', getOutlets);
router.get('/target', getTargetRevenue);
router.get('/payment-methods', getPaymentMethods);
router.get('/customer-sources', getCustomerSources);
router.get('/petty-cash-categories', getPettyCashCategories);
router.get('/promos', getPromos);
router.get('/customer-tiers', getCustomerTiers);
router.get('/work-statuses', getWorkStatuses);

export default router;
