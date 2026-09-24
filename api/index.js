import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth/login.routes.js';
import customerRoutes from './routes/customer.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import serviceRoutes from './routes/service.routes.js';
import membershipRoutes from './routes/membership.routes.js';
import pettyCashRoutes from './routes/pettyCash.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import shiftRoutes from './routes/shift.routes.js';
import masterRoutes from './routes/master.routes.js';
import historyRoutes from './routes/history.routes.js';
import printerRoutes from './routes/printer.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import qcRoutes from './routes/qc.routes.js';
import { getBaseUploadDir, getUploadUrlPrefix, uploadPaymentReceipt, verifyUploadContents, buildUploadPublicUrl, safeUnlinkUploadUrl } from './middleware/upload.js';
import { requirePosAuth } from './middleware/requireAuth.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static uploaded files — prefix URL = nama folder UPLOAD_BASE_DIR
app.use(getUploadUrlPrefix(), express.static(getBaseUploadDir()));

// General upload endpoint for payment proofs / images
// Optional body field oldUrl: hapus file lama saat ganti bukti
app.post('/api/upload', requirePosAuth, uploadPaymentReceipt, verifyUploadContents, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'File tidak diunggah' });
  }
  const filename = req.file.filename || path.basename(req.file.path);
  const relativePath = `assets/payment_receipt/${filename}`;
  const publicUrl = buildUploadPublicUrl(relativePath);
  const oldUrl = req.body?.oldUrl || req.body?.old_url || null;
  if (oldUrl) {
    await safeUnlinkUploadUrl(oldUrl);
  }
  return res.json({ success: true, url: publicUrl, filename });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/petty-cash', pettyCashRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/masters', masterRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/printer-settings', printerRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/qc', qcRoutes);

export default app;
