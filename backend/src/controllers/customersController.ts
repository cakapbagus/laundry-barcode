import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function searchCustomers(req: Request, res: Response): Promise<void> {
  try {
    const { q } = req.query;

    const customers = await prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q as string } },
              { customerId: { contains: q as string } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
      take: 20,
    });

    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function createCustomer(req: Request, res: Response): Promise<void> {
  try {
    const { name, customerId } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Nama santri wajib diisi' });
      return;
    }

    if (!customerId) {
      res.status(400).json({ error: 'NIS wajib diisi' });
      return;
    }

    const existing = await prisma.customer.findUnique({ where: { customerId } });
    if (existing) {
      res.status(409).json({ error: `NIS ${customerId} sudah terdaftar atas nama ${existing.name}` });
      return;
    }

    const customer = await prisma.customer.create({
      data: { name, customerId },
    });

    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
