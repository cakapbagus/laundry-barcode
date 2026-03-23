import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  listMachines,
  createMachine,
  updateMachine,
  deleteMachine,
} from '../controllers/machinesController';

const router = Router();

router.use(authenticate);

router.get('/', listMachines);
router.post('/', requireRole('MANAGER'), createMachine);
router.put('/:id', requireRole('MANAGER'), updateMachine);
router.delete('/:id', requireRole('MANAGER'), deleteMachine);

export default router;
