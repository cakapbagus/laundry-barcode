import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { generateOrderCode } from '../utils/orderCode';
import { getIo } from '../server';

const prisma = new PrismaClient();

export async function createOrder(req: Request, res: Response): Promise<void> {
  try {
    const { customerId, notes } = req.body;

    if (!customerId) {
      res.status(400).json({ error: 'ID santri wajib diisi' });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ error: 'Santri tidak ditemukan' });
      return;
    }

    // Duplicate prevention: same customer within 30 min today
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const existing = await prisma.order.findFirst({
      where: {
        customerId,
        createdAt: { gte: thirtyMinAgo },
        status: { not: 'PICKED_UP' },
      },
    });

    if (existing) {
      res.status(409).json({
        error: `Order untuk ${customer.nama} (NIS: ${customer.nis}) sudah dibuat dalam 30 menit terakhir (${existing.orderCode})`,
      });
      return;
    }

    const orderCode = await generateOrderCode(prisma);

    const completionDaysSetting = await prisma.setting.findUnique({
      where: { key: 'COMPLETION_DAYS' },
    });
    const completionDays = parseInt(completionDaysSetting?.value || '3');
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + completionDays);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const trackUrl = `${frontendUrl}/track?order=${orderCode}`;
    const qrCode = await QRCode.toDataURL(trackUrl, { width: 300 });

    const order = await prisma.order.create({
      data: {
        orderCode,
        qrCode,
        customerId: customer.id,
        notes: notes?.trim() || null,
        status: 'INTAKE',
        estimatedCompletion,
        createdByUserId: req.user!.id,
      },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    await prisma.stageHistory.create({
      data: {
        orderId: order.id,
        fromStage: null,
        toStage: 'INTAKE',
        operatorId: req.user!.id,
      },
    });

    await prisma.scanLog.create({
      data: {
        orderId: order.id,
        operatorId: req.user!.id,
        scanType: 'INTAKE_START',
        status: 'success',
      },
    });

    try {
      const io = getIo();
      io.emit('order:created', order);
      io.emit('dashboard:refresh');
    } catch {}

    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function listOrders(req: Request, res: Response): Promise<void> {
  try {
    const { status, page = '1', limit = '20', search, kamar, kelas } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;
    if (kamar) where.customer = { ...where.customer, kamar: kamar as string };
    if (kelas) where.customer = { ...where.customer, kelas: kelas as string };
    if (search) {
      where.OR = [
        { orderCode: { contains: search as string } },
        { customer: { nama: { contains: search as string } } },
        { customer: { nis: { contains: search as string } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: true,
          createdBy: { select: { id: true, name: true, role: true } },
          history: {
            orderBy: { startedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('List orders error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true, role: true } },
        history: {
          include: {
            operator: { select: { id: true, name: true, role: true } },
          },
          orderBy: { startedAt: 'asc' },
        },
        scanLogs: {
          include: {
            operator: { select: { id: true, name: true } },
          },
          orderBy: { scannedAt: 'desc' },
        },
      },
    });

    if (!order) {
      res.status(404).json({ error: 'Order tidak ditemukan' });
      return;
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function deleteOrder(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      res.status(404).json({ error: 'Order tidak ditemukan' });
      return;
    }

    if (order.status !== 'INTAKE') {
      res.status(400).json({ error: 'Order hanya bisa dihapus saat masih di status Penerimaan' });
      return;
    }

    await prisma.$transaction([
      prisma.scanLog.deleteMany({ where: { orderId: id } }),
      prisma.stageHistory.deleteMany({ where: { orderId: id } }),
      prisma.order.delete({ where: { id } }),
    ]);

    try {
      const io = getIo();
      io.emit('order:deleted', { id });
      io.emit('dashboard:refresh');
    } catch {}

    res.status(204).end();
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function completeOrder(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      res.status(404).json({ error: 'Order tidak ditemukan' });
      return;
    }

    if (order.status === 'PICKED_UP') {
      res.status(400).json({ error: 'Order sudah diambil' });
      return;
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'PICKED_UP',
        completedAt: new Date(),
      },
    });

    try {
      const io = getIo();
      io.emit('order:completed', updated);
      io.emit('dashboard:refresh');
    } catch {}

    res.json(updated);
  } catch (error) {
    console.error('Complete order error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
