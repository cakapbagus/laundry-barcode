import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { STAGE_LABELS } from '../utils/stageFlow';

const prisma = new PrismaClient();

export async function trackOrder(req: Request, res: Response): Promise<void> {
  try {
    const { orderCode } = req.params;

    const order = await prisma.order.findUnique({
      where: { orderCode },
      include: {
        customer: true,
        history: {
          include: {
            operator: { select: { id: true, name: true } },
          },
          orderBy: { startedAt: 'asc' },
        },
      },
    });

    if (!order) {
      res.status(404).json({ error: 'Order tidak ditemukan' });
      return;
    }

    // Remove QR code data to keep response lean
    const { qrCode, ...orderData } = order;

    res.json({
      ...orderData,
      statusLabel: STAGE_LABELS[order.status] || order.status,
    });
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
