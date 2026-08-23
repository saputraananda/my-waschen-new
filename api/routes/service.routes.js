import express from 'express';
import {
  getServices,
  getServiceSpeeds,
  getParfumes,
  getUnits,
  createService
} from '../controllers/service.controller.js';

const router = express.Router();

router.get('/', getServices);
router.get('/speeds', getServiceSpeeds);
router.get('/parfumes', getParfumes);
router.get('/units', getUnits);
router.post('/', createService);

export default router;
