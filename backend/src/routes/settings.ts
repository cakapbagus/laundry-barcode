import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getSettings, updateSetting } from '../controllers/settingsController';

const router = Router();

router.use(authenticate);
router.use(requireRole('MANAGER'));

router.get('/', getSettings);
router.put('/:key', updateSetting);

export default router;
