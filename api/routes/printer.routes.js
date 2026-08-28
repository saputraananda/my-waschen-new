import express from 'express';
import { getPrinterSettings, savePrinterSettings } from '../controllers/printer.controller.js';

const router = express.Router();

router.get('/', getPrinterSettings);
router.put('/', savePrinterSettings);

export default router;
