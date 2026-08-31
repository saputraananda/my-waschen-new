import express from 'express';
import {
  listInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  listOutletStock,
  updateStockThresholds,
  saveStockOpname,
  ensureOutletStockRows,
  createStockMovement,
  listInventoryLogs,
  getServiceBom,
  saveServiceBom
} from '../controllers/inventory.controller.js';

const router = express.Router();

router.get('/items', listInventoryItems);
router.post('/items', createInventoryItem);
router.put('/items/:id', updateInventoryItem);

router.get('/stock', listOutletStock);
router.put('/stock/:stockId', updateStockThresholds);
router.put('/opname', saveStockOpname);
router.post('/stock/ensure', ensureOutletStockRows);

router.post('/movements', createStockMovement);
router.get('/logs', listInventoryLogs);

router.get('/service-bom/:serviceId', getServiceBom);
router.put('/service-bom/:serviceId', saveServiceBom);

export default router;
