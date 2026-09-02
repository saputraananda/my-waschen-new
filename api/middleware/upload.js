import fs from 'fs';
import path from 'path';
import multer from 'multer';

/** Subfolder bukti bayar di dalam UPLOAD_BASE_DIR */
export const PAYMENT_RECEIPT_SUBDIR = 'assets/payment_receipt';
/** Bukti pengajuan petty cash */
export const PETTY_CASH_EVIDENCE_SUBDIR = 'evidence-petty-cash';
/** Bukti setoran tunai frontliner (deposit report) */
export const DEPOSIT_REPORT_FRONTLINER_SUBDIR = 'assets/deposit-report-frontliner';

/**
 * Get base upload directory path from UPLOAD_BASE_DIR environment variable
 * Fallback to local 'uploads' directory if not specified
 */
export const getBaseUploadDir = () => {
  const envDir = process.env.UPLOAD_BASE_DIR ? process.env.UPLOAD_BASE_DIR.trim() : '';
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.resolve(process.cwd(), envDir);
  }
  // Local development default fallback: <project_root>/uploads
  return path.resolve(process.cwd(), 'uploads');
};

/**
 * URL prefix publik mengikuti nama folder UPLOAD_BASE_DIR
 * Contoh: UPLOAD_BASE_DIR=uploads → /uploads
 *         UPLOAD_BASE_DIR=/var/www/data/uploads → /uploads
 */
export const getUploadUrlPrefix = () => {
  const raw = (process.env.UPLOAD_BASE_DIR || 'uploads').trim().replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = raw.split('/').filter(Boolean);
  let segment = parts[parts.length - 1] || 'uploads';
  // Hindari segment drive Windows (C:)
  if (/^[A-Za-z]:$/.test(segment)) {
    segment = 'uploads';
  }
  return `/${segment}`;
};

/**
 * Bangun URL publik file relatif terhadap UPLOAD_BASE_DIR
 * @param {string} relativePath - path di dalam UPLOAD_BASE_DIR, e.g. assets/payment_receipt/a.jpg
 */
export const buildUploadPublicUrl = (relativePath) => {
  if (!relativePath) return null;
  const rel = String(relativePath).replace(/\\/g, '/').replace(/^\/+/, '');
  return `${getUploadUrlPrefix()}/${rel}`;
};

/**
 * Automatically creates target subfolder inside UPLOAD_BASE_DIR if it doesn't exist yet
 *
 * @param {string} subFolder - Relative subfolder path (e.g. 'assets/evidence', 'assets/payment_receipt')
 * @returns {string} Absolute path of created folder
 */
export const ensureUploadFolder = (subFolder = '') => {
  const baseDir = getBaseUploadDir();
  const targetDir = subFolder ? path.join(baseDir, subFolder) : baseDir;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  return targetDir;
};

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};

/**
 * Dynamic Multer Upload Middleware Factory
 * Automatically checks and creates subfolders inside process.env.UPLOAD_BASE_DIR
 *
 * @param {string} subFolder - Subfolder path (e.g. 'assets/evidence', 'assets/payment_receipt')
 * @param {Object} options - Custom options (fileTypes, maxFileSize)
 */
export const createUploader = (subFolder = 'assets/documents', options = {}) => {
  const {
    fileTypes = /jpeg|jpg|png|webp|pdf|doc|docx/,
    maxFileSize = 10 * 1024 * 1024 // Default 10MB
  } = options;

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const targetPath = ensureUploadFolder(subFolder);
        cb(null, targetPath);
      } catch (err) {
        cb(err, null);
      }
    },
    filename: (req, file, cb) => {
      let ext = path.extname(file.originalname || '').toLowerCase();
      if (!ext) {
        ext = MIME_EXT[(file.mimetype || '').toLowerCase()] || '.jpg';
      }
      const rawName = path.basename(file.originalname || 'capture', path.extname(file.originalname || ''))
        || 'capture';
      const nameWithoutExt = rawName
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 30) || 'capture';
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `${nameWithoutExt}_${uniqueSuffix}${ext}`);
    }
  });

  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().replace('.', '');
    const mime = (file.mimetype || '').toLowerCase();
    const extOk = !ext || fileTypes.test(ext);
    const mimeOk = fileTypes.test(mime);

    if (extOk || mimeOk) {
      return cb(null, true);
    }
    cb(new Error(`Tipe file tidak didukung (${file.originalname || mime}). Format yang diperbolehkan: jpeg, jpg, png, webp, pdf`));
  };

  return multer({
    storage,
    limits: { fileSize: maxFileSize },
    fileFilter
  });
};

/** Bukti pembayaran → {UPLOAD_BASE_DIR}/assets/payment_receipt */
export const uploadPaymentReceipt = createUploader(PAYMENT_RECEIPT_SUBDIR, {
  fileTypes: /jpeg|jpg|png|webp|pdf/,
  maxFileSize: 5 * 1024 * 1024
}).single('proof');

export const uploadPettyCashEvidence = createUploader(PETTY_CASH_EVIDENCE_SUBDIR, {
  fileTypes: /jpeg|jpg|png|webp|pdf/,
  maxFileSize: 5 * 1024 * 1024
}).single('evidence');

/** Bukti setoran tunai frontliner → {UPLOAD_BASE_DIR}/assets/deposit-report-frontliner */
export const uploadDepositReport = createUploader(DEPOSIT_REPORT_FRONTLINER_SUBDIR, {
  fileTypes: /jpeg|jpg|png|webp|pdf/,
  maxFileSize: 5 * 1024 * 1024
}).single('proof');

export const uploadEvidence = createUploader('assets/evidence');

export default createUploader;
