import express from 'express';
import { loginUser } from '../../controllers/auth/login.controller.js';

const router = express.Router();

router.post('/login', loginUser);

export default router;
