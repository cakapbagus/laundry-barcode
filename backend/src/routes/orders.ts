import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  createOrder,
  listOrders,
  getOrder,
  deleteOrder,
  completeOrder,
} from '../controllers/ordersController';

const router = Router();

router.use(authenticate);

router.post('/', requireRole('KASIR', 'MANAGER'), createOrder);
router.get('/', listOrders);
router.get('/:id', getOrder);
router.delete('/:id', requireRole('KASIR', 'MANAGER', 'OPERATOR'), deleteOrder);
router.patch('/:id/complete', requireRole('KASIR', 'MANAGER', 'OPERATOR'), completeOrder);

export default router;
