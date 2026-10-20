import path from 'path';
import express from 'express';
import { requireSyncToken } from './complaintInternal.routes.js';
import {
  uploadDeleteRequestAttachment,
  verifyUploadContents,
  buildUploadPublicUrl,
  DELETE_REQUEST_SUBDIR
} from '../middleware/upload.js';

const router = express.Router();

function takeUpload(req, res, next) {
  uploadDeleteRequestAttachment(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File maksimal 5 MB' : `File tidak valid: ${err.message}`;
    return res.status(400).json({ success: false, message });
  });
}

/** Lampiran pengajuan hapus nota dari Super App → {UPLOAD_BASE_DIR}/assets/delete-request */
router.post('/', requireSyncToken, takeUpload, verifyUploadContents, (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'File tidak diunggah' });
  const filename = path.basename(req.file.filename || req.file.path);
  res.status(201).json({ success: true, path: buildUploadPublicUrl(`${DELETE_REQUEST_SUBDIR}/${filename}`) });
});

export default router;
