import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import multer from 'multer';
import { ensureUploadFolder, safeUnlinkAbsPath } from '../middleware/upload.js';

const router = express.Router();
const DOC_DIR = 'assets/complaint_docs';
const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,179}$/;
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.heic', '.heif']);

/** Nama file dari Super App, tanpa path. */
export function isSafeComplaintDocName(name) {
  const base = path.basename(String(name || ''));
  if (base !== String(name || '') || !NAME_RE.test(base)) return false;
  return ALLOWED_EXT.has(path.extname(base).toLowerCase());
}

function tokenOk(headerValue) {
  const expected = process.env.WASCHEN_POS_TOKEN || '';
  const got = String(headerValue || '');
  if (expected.length < 16 || expected.length !== got.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

function requireSyncToken(req, res, next) {
  if (!tokenOk(req.headers['x-complaint-sync-token'])) {
    return res.status(401).json({ success: false, message: 'Tidak diizinkan' });
  }
  return next();
}

function hasSig(buf, offset, bytes) {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function contentsOk(buf, ext) {
  if (ext === '.pdf') return hasSig(buf, 0, [0x25, 0x50, 0x44, 0x46]);
  if (ext === '.png') return hasSig(buf, 0, [0x89, 0x50, 0x4e, 0x47]);
  if (ext === '.gif') return buf.slice(0, 6).toString('ascii') === 'GIF87a' || buf.slice(0, 6).toString('ascii') === 'GIF89a';
  if (ext === '.webp') return hasSig(buf, 0, [0x52, 0x49, 0x46, 0x46]) && hasSig(buf, 8, [0x57, 0x45, 0x42, 0x50]);
  if (ext === '.heic' || ext === '.heif') return buf.slice(4, 8).toString('ascii') === 'ftyp';
  return hasSig(buf, 0, [0xff, 0xd8, 0xff]);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, ensureUploadFolder(DOC_DIR));
      } catch (err) {
        cb(err);
      }
    },
    filename: (_req, file, cb) => {
      const name = path.basename(file.originalname || '');
      if (!isSafeComplaintDocName(name)) return cb(new Error('Nama file tidak valid'));
      cb(null, name);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = path.basename(file.originalname || '');
    if (!isSafeComplaintDocName(name)) return cb(new Error('Tipe file tidak didukung'));
    cb(null, true);
  }
}).single('file');

function takeUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File maksimal 5 MB' : 'File tidak valid';
    return res.status(400).json({ success: false, message });
  });
}

async function checkContents(req, res, next) {
  if (!req.file?.path) return res.status(400).json({ success: false, message: 'File tidak diunggah' });
  try {
    const fh = await fs.promises.open(req.file.path, 'r');
    const buf = Buffer.alloc(16);
    await fh.read(buf, 0, 16, 0);
    await fh.close();
    const ext = path.extname(req.file.filename).toLowerCase();
    if (!contentsOk(buf, ext)) {
      await safeUnlinkAbsPath(req.file.path);
      return res.status(400).json({ success: false, message: 'Isi file tidak sesuai format yang diizinkan' });
    }
    return next();
  } catch {
    await safeUnlinkAbsPath(req.file?.path);
    return res.status(400).json({ success: false, message: 'File tidak bisa diperiksa' });
  }
}

router.post('/', requireSyncToken, takeUpload, checkContents, (req, res) => {
  res.status(201).json({ success: true, filename: req.file.filename });
});

router.delete('/:filename', requireSyncToken, async (req, res) => {
  const filename = path.basename(String(req.params.filename || ''));
  if (!isSafeComplaintDocName(filename)) {
    return res.status(400).json({ success: false, message: 'Nama file tidak valid' });
  }
  const abs = path.join(ensureUploadFolder(DOC_DIR), filename);
  await safeUnlinkAbsPath(abs);
  res.json({ success: true });
});

export default router;
