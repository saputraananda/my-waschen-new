import path from 'path';
import express from 'express';
import { requireSyncToken } from './complaintInternal.routes.js';
import {
  uploadRefundApprovalProof,
  verifyUploadContents,
  buildUploadPublicUrl,
  REFUND_APPROVAL_SUBDIR
} from '../middleware/upload.js';

const router = express.Router();

function takeUpload(req, res, next) {
  uploadRefundApprovalProof(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File maksimal 5 MB' : `File tidak valid: ${err.message}`;
    return res.status(400).json({ success: false, message });
  });
}

/** Bukti pembayaran refund dari admin Super App → {UPLOAD_BASE_DIR}/assets/refund-approval */
router.post('/', requireSyncToken, takeUpload, verifyUploadContents, (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'File tidak diunggah' });
  const filename = path.basename(req.file.filename || req.file.path);
  res.status(201).json({ success: true, path: buildUploadPublicUrl(`${REFUND_APPROVAL_SUBDIR}/${filename}`) });
});

export default router;
