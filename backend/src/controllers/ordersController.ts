import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { generateOrderCode } from '../utils/orderCode';
import { getIo } from '../server';

const prisma = new PrismaClient();

export async function createOrder(req: Request, res: Response): Promise<void> {
  try {
    const { customerId, customerName, weightKg, itemDescription, notes } = req.body;

    if (!customerName || !weightKg) {
      res.status(400).json({ error: 'Nama santri dan berat wajib diisi' });
      return;
    }

    if (Number(weightKg) <= 0) {
      res.status(400).json({ error: 'Berat harus lebih dari 0 kg' });
      return;
    }

    // Duplicate prevention: same customerName within 30 min today
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existing = await prisma.order.findFirst({
      where: {
        customerName,
        createdAt: { gte: thirtyMinAgo },
        status: { not: 'PICKED_UP' },
      },
    });

    if (existing) {
      res.status(409).json({
        error: `Order untuk ${customerName} sudah dibuat dalam 30 menit terakhir (${existing.orderCode})`,
      });
      return;
    }

    // Get or create customer
    let customer;
    if (!customerId) {
      res.status(400).json({ error: 'NIS wajib diisi' });
      return;
    }

    customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ error: 'Santri tidak ditemukan' });
      return;
    }

    // Generate order code
    const orderCode = await generateOrderCode(prisma);

    // Get completion days setting
    const completionDaysSetting = await prisma.setting.findUnique({
      where: { key: 'COMPLETION_DAYS' },
    });
    const completionDays = parseInt(completionDaysSetting?.value || '3');
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + completionDays);

    // Generate QR code (URL to track)
    const trackUrl = `http://localhost:5173/track?order=${orderCode}`;
    const qrCode = await QRCode.toDataURL(trackUrl, { width: 300 });

    const order = await prisma.order.create({
      data: {
        orderCode,
        qrCode,
        customerId: customer.id,
        customerName,
        weightKg: Number(weightKg),
        itemDescription: itemDescription || null,
        notes: notes || null,
        status: 'INTAKE',
        estimatedCompletion,
        createdByUserId: req.user!.id,
      },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    // Create initial stage history
    await prisma.stageHistory.create({
      data: {
        orderId: order.id,
        fromStage: null,
        toStage: 'INTAKE',
        operatorId: req.user!.id,
      },
    });

    // Create scan log
    await prisma.scanLog.create({
      data: {
        orderId: order.id,
        operatorId: req.user!.id,
        scanType: 'INTAKE_START',
        status: 'success',
      },
    });

    // Broadcast via WebSocket
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
    const { status, page = '1', limit = '20', search } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderCode: { contains: search as string } },
        { customerName: { contains: search as string } },
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
