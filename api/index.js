import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth/login.routes.js';
import targetRoutes from './routes/additional/target.routes.js';
import outletRoutes from './routes/additional/outlet.routes.js';
import customerRoutes from './routes/customer.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import serviceRoutes from './routes/service.routes.js';
import membershipRoutes from './routes/membership.routes.js';
import pettyCashRoutes from './routes/pettyCash.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { getBaseUploadDir } from './middleware/upload.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static uploaded files (/uploads)
app.use('/uploads', express.static(getBaseUploadDir()));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/target', targetRoutes);
app.use('/api/outlets', outletRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/petty-cash', pettyCashRoutes);
app.use('/api/dashboard', dashboardRoutes);

export default app;
