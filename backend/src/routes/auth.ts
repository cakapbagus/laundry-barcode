import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login } from '../controllers/authController';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10,                   // maks 10 percobaan per IP per window
  skipSuccessfulRequests: true, // hanya hitung percobaan yang gagal
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

router.post('/login', loginLimiter, login);

export default router;
