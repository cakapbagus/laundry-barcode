import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getSummary,
  getOrdersByStatus,
  getDailyReport,
} from '../controllers/dashboardController';

const router = Router();

router.use(authenticate);
router.use(requireRole('MANAGER'));

router.get('/summary', getSummary);
router.get('/orders-by-status', getOrdersByStatus);
router.get('/reports/daily', getDailyReport);

export default router;
