import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { STAGE_LABELS } from '../utils/stageFlow';

const prisma = new PrismaClient();

const ORDER_INCLUDE = {
  customer: true,
  history: {
    include: {
      operator: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: 'asc' as const },
  },
};

function formatOrder(order: any) {
  const { qrCode, ...orderData } = order;
  return {
    ...orderData,
    statusLabel: STAGE_LABELS[order.status] || order.status,
  };
}

export async function trackOrder(req: Request, res: Response): Promise<void> {
  try {
    const { orderCode } = req.params;

    const order = await prisma.order.findUnique({
      where: { orderCode },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      res.status(404).json({ error: 'Order tidak ditemukan' });
      return;
    }

    res.json(formatOrder(order));
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function trackOrderByNis(req: Request, res: Response): Promise<void> {
  try {
    const { nis } = req.params;

    let customer = await prisma.customer.findUnique({ where: { nis } });
    if (!customer) {
      customer = await prisma.customer.findFirst({ where: { noHape: nis } });
    }
    if (!customer) {
      res.status(404).json({ error: `Santri dengan NIS / No HP ${nis} tidak ditemukan` });
      return;
    }

    // Find the most recent non-picked-up order, fallback to latest overall
    const order = await prisma.order.findFirst({
      where: {
        customerId: customer.id,
        status: { not: 'PICKED_UP' },
      },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    }) ?? await prisma.order.findFirst({
      where: { customerId: customer.id },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    if (!order) {
      res.status(404).json({ error: `Belum ada order untuk santri ${customer.nama} (NIS: ${nis})` });
      return;
    }

    res.json(formatOrder(order));
  } catch (error) {
    console.error('Track by NIS error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
