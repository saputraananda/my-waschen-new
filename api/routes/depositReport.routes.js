import { Router } from 'express';
import {
  listDepositReport,
  getPendingDepositCount,
  uploadDepositProof,
  uploadEventDepositProof
} from '../controllers/depositReport.controller.js';
import { uploadDepositReport, verifyUploadContents } from '../middleware/upload.js';
import { requirePosAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/', requirePosAuth, listDepositReport);
router.get('/pending-count', requirePosAuth, getPendingDepositCount);
router.post('/event/:outletId/:date/proof', requirePosAuth, uploadDepositReport, verifyUploadContents, uploadEventDepositProof);
router.post('/:id/proof', requirePosAuth, uploadDepositReport, verifyUploadContents, uploadDepositProof);

export default router;
