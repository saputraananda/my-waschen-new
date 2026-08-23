import express from 'express';
import {
  getMembershipPackages,
  getMemberships,
  createMembership
} from '../controllers/membership.controller.js';

const router = express.Router();

router.get('/packages', getMembershipPackages);
router.get('/', getMemberships);
router.post('/', createMembership);

export default router;
