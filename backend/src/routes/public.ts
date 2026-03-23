import { Router } from 'express';
import { trackOrder } from '../controllers/publicController';

const router = Router();

router.get('/track/:orderCode', trackOrder);

export default router;
