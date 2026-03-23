import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { JWT_SECRET } from '../middleware/auth';

const prisma = new PrismaClient();

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      res.status(400).json({ error: 'Nama dan password wajib diisi' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { name } });
    if (!user) {
      res.status(401).json({ error: 'Nama tidak ditemukan' });
      return;
    }

    if (!user.active) {
      res.status(401).json({ error: 'Akun tidak aktif' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Password salah' });
      return;
    }

    const payload = {
      id: user.id,
      name: user.name,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: payload,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
