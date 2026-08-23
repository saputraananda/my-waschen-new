import express from 'express';
import {
  getPettyCashLogs,
  addPettyCashEntry,
  getCurrentShift,
  openShift
} from '../controllers/pettyCash.controller.js';

const router = express.Router();

router.get('/', getPettyCashLogs);
router.post('/', addPettyCashEntry);
router.get('/shift/current', getCurrentShift);
router.post('/shift/open', openShift);

export default router;
