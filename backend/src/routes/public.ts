import { Router } from 'express';
import { trackOrder, trackOrderByNis } from '../controllers/publicController';

const router = Router();

router.get('/track/by-nis/:nis', trackOrderByNis);
router.get('/track/:orderCode', trackOrder);

export default router;
