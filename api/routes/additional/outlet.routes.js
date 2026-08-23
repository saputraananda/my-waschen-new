import express from 'express';
import { getOutlets } from '../../controllers/additional/outlet.controller.js';

const router = express.Router();

router.get('/', getOutlets);

export default router;
