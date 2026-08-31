import express from 'express';
import {
  getPettyCashLogs,
  addPettyCashEntry,
  reviewPettyCashEntry,
  uploadPettyCashEvidenceFile,
  getCurrentShift,
  openShift
} from '../controllers/pettyCash.controller.js';
import { uploadPettyCashEvidence } from '../middleware/upload.js';

const router = express.Router();

router.get('/', getPettyCashLogs);
router.post('/upload-evidence', uploadPettyCashEvidence, uploadPettyCashEvidenceFile);
router.post('/', uploadPettyCashEvidence, addPettyCashEntry);
router.patch('/:id/review', reviewPettyCashEntry);
router.get('/shift/current', getCurrentShift);
router.post('/shift/open', openShift);

export default router;
