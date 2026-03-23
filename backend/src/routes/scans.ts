import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { stageTransition, integrityCheck } from '../controllers/scansController';

const router = Router();

router.use(authenticate);

router.post('/stage-transition', requireRole('OPERATOR', 'KASIR', 'MANAGER'), stageTransition);
router.post('/integrity-check', integrityCheck);

export default router;
