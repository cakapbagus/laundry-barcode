import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'laundry-secret-key-2024';
const prisma = new PrismaClient();

export interface AuthUser {
  id: string;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token tidak ditemukan' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    const dbUser = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, name: true, role: true } });
    if (!dbUser) {
      res.status(401).json({ error: 'Akun tidak ditemukan, silakan login ulang' });
      return;
    }
    req.user = dbUser;
    next();
  } catch {
    res.status(401).json({ error: 'Token tidak valid atau sudah expired' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Tidak terautentikasi' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Akses ditolak: role tidak mencukupi' });
      return;
    }
    next();
  };
}

export { JWT_SECRET };
