import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { listUsers, createUser, updateUser, deleteUser } from '../controllers/usersController';

const router = Router();

router.use(authenticate);
router.use(requireRole('MANAGER'));

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
