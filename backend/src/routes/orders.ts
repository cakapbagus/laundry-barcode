import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  createOrder,
  listOrders,
  getOrder,
  cancelOrder,
  completeOrder,
} from '../controllers/ordersController';

const router = Router();

router.use(authenticate);

router.post('/', requireRole('KASIR', 'MANAGER'), createOrder);
router.get('/', listOrders);
router.get('/:id', getOrder);
router.patch('/:id/cancel', requireRole('KASIR', 'MANAGER', 'OPERATOR'), cancelOrder);
router.patch('/:id/complete', requireRole('KASIR', 'MANAGER', 'OPERATOR'), completeOrder);

export default router;
