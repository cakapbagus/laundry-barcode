import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const USER_SELECT = {
  id: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const { name, password, role } = req.body;

    if (!name || !password || !role) {
      res.status(400).json({ error: 'Nama, password, dan role wajib diisi' });
      return;
    }
    if (role === 'MANAGER') {
      res.status(403).json({ error: 'Tidak dapat membuat akun MANAGER' });
      return;
    }
    if (!['KASIR', 'OPERATOR', 'MUSYRIF'].includes(role)) {
      res.status(400).json({ error: 'Role tidak valid (KASIR, OPERATOR, atau MUSYRIF)' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { name } });
    if (existing) {
      res.status(409).json({ error: 'Nama pengguna sudah digunakan' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, passwordHash, role, active: true, createdByUserId: req.user!.id },
      select: USER_SELECT,
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      return;
    }
    if (user.role === 'MANAGER') {
      res.status(403).json({ error: 'Tidak dapat menghapus akun MANAGER' });
      return;
    }
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, active, password, role } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      return;
    }
    if (user.role === 'MANAGER' && active === false) {
      res.status(403).json({ error: 'Tidak dapat menonaktifkan akun MANAGER' });
      return;
    }
    if (role !== undefined && user.role !== 'MANAGER') {
      res.status(403).json({ error: 'Tidak dapat mengubah role akun MANAGER' });
      return;
    }
    if (role !== undefined && !['KASIR', 'OPERATOR', 'MUSYRIF', 'MANAGER'].includes(role)) {
      res.status(400).json({ error: 'Role tidak valid (KASIR, OPERATOR, atau MUSYRIF)' });
      return;
    }

    if (name !== undefined && name !== user.name) {
      const existing = await prisma.user.findUnique({ where: { name } });
      if (existing) {
        res.status(409).json({ error: 'Nama pengguna sudah digunakan' });
        return;
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (active !== undefined) updateData.active = active;
    if (role !== undefined) updateData.role = role;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
