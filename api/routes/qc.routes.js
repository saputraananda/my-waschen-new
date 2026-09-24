import express from 'express';
import { getQcList, submitPosQc, resolvePosHold, uploadQcPhotos } from '../controllers/qc.controller.js';

const router = express.Router();

router.get('/list', getQcList);
router.post('/submit', uploadQcPhotos, submitPosQc);
router.post('/hold-resolve', resolvePosHold);

export default router;
