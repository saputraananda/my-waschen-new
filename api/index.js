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
import { getBaseUploadDir, getUploadUrlPrefix, uploadPaymentReceipt, buildUploadPublicUrl } from './middleware/upload.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static uploaded files — prefix URL = nama folder UPLOAD_BASE_DIR
app.use(getUploadUrlPrefix(), express.static(getBaseUploadDir()));

// General upload endpoint for payment proofs / images
app.post('/api/upload', uploadPaymentReceipt, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'File tidak diunggah' });
  }
  const filename = req.file.filename || path.basename(req.file.path);
  const relativePath = `assets/payment_receipt/${filename}`;
  const publicUrl = buildUploadPublicUrl(relativePath);
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

export default app;
