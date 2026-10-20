import express from 'express';
import {
  getMembershipPackages,
  getMemberships,
  getMembershipMutations,
  createMembership
} from '../controllers/membership.controller.js';
import { uploadPaymentReceipt, verifyUploadContents } from '../middleware/upload.js';
import { requirePosAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.get('/packages', getMembershipPackages);
router.get('/mutations', getMembershipMutations);
router.get('/', getMemberships);
router.post('/', requirePosAuth, uploadPaymentReceipt, verifyUploadContents, createMembership);

export default router;
