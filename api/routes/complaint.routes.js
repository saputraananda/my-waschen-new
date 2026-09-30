import express from 'express';
import { requirePosAuth } from '../middleware/requireAuth.js';
import { createUploader } from '../middleware/upload.js';
import {
  getComplaintMeta,
  searchComplaintNota,
  getComplaintNotaItems,
  listOutletComplaints,
  getOutletComplaintDetail,
  createComplaintRequest
} from '../controllers/complaint.controller.js';

const router = express.Router();
const uploadComplaint = createUploader('assets/complaint_docs', {
  fileTypes: /jpeg|jpg|png|webp|pdf|heic|heif/,
  maxFileSize: 5 * 1024 * 1024
});

router.get('/meta', requirePosAuth, getComplaintMeta);
router.get('/nota', requirePosAuth, searchComplaintNota);
router.get('/nota/items', requirePosAuth, getComplaintNotaItems);
router.get('/', requirePosAuth, listOutletComplaints);
router.get('/:id', requirePosAuth, getOutletComplaintDetail);
router.post('/request', requirePosAuth, uploadComplaint.array('documents', 8), createComplaintRequest);

export default router;
