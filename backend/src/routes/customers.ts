import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { searchCustomers, createCustomer } from '../controllers/customersController';

const router = Router();

router.use(authenticate);

router.get('/', searchCustomers);
router.post('/', createCustomer);

export default router;
