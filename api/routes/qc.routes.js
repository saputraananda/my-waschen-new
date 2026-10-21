import express from 'express';
import { getQcList, getItemKgMaster, submitPosQc, resolvePosHold, uploadQcPhotos } from '../controllers/qc.controller.js';

const router = express.Router();

router.get('/list', getQcList);
router.get('/item-kg', getItemKgMaster);
router.post('/submit', uploadQcPhotos, submitPosQc);
router.post('/hold-resolve', resolvePosHold);

export default router;
