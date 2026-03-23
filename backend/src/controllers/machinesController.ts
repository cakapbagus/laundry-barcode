import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VALID_CATEGORIES = ['WASH', 'DRY', 'IRON'];

export async function deleteMachine(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const machine = await prisma.machine.findUnique({ where: { id } });
    if (!machine) {
      res.status(404).json({ error: 'Mesin tidak ditemukan' });
      return;
    }
    await prisma.machine.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function listMachines(req: Request, res: Response): Promise<void> {
  try {
    const { active, category } = req.query;
    const where: any = {};
    if (active === 'true') where.active = true;
    if (category) where.category = category;

    const machines = await prisma.machine.findMany({
      where,
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
    res.json(machines);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function createMachine(req: Request, res: Response): Promise<void> {
  try {
    const { code, name, category } = req.body;
    if (!code || !name || !category) {
      res.status(400).json({ error: 'Kode, nama, dan kategori mesin wajib diisi' });
      return;
    }
    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Kategori harus salah satu dari: WASH, DRY, IRON' });
      return;
    }

    const existing = await prisma.machine.findUnique({ where: { code } });
    if (existing) {
      res.status(409).json({ error: 'Kode mesin sudah digunakan' });
      return;
    }

    const machine = await prisma.machine.create({
      data: { code, name, category, active: true },
    });
    res.status(201).json(machine);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function updateMachine(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, category, active } = req.body;

    if (category && !VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Kategori harus salah satu dari: WASH, DRY, IRON' });
      return;
    }

    const machine = await prisma.machine.findUnique({ where: { id } });
    if (!machine) {
      res.status(404).json({ error: 'Mesin tidak ditemukan' });
      return;
    }

    const updated = await prisma.machine.update({
      where: { id },
      data: {
        name: name ?? machine.name,
        category: category ?? machine.category,
        active: active !== undefined ? active : machine.active,
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
