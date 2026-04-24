import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { generateOrderCode } from '../utils/orderCode';
import { getIo } from '../server';

const prisma = new PrismaClient();

export async function createOrder(req: Request, res: Response): Promise<void> {
  try {
    const { customerId, notes, berat } = req.body;

    if (!customerId) {
      res.status(400).json({ error: 'ID santri wajib diisi' });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ error: 'Santri tidak ditemukan' });
      return;
    }

    // ── DEPOSIT flow ──────────────────────────────────────────────────────────
    let beratKg: number | null = null;
    let biaya: number | null = null;

    if (customer.tipe === 'DEPOSIT') {
      const beratRaw = parseFloat(berat);
      if (!berat || isNaN(beratRaw) || beratRaw <= 0) {
        res.status(400).json({ error: 'Berat cucian wajib diisi untuk santri deposit', code: 'BERAT_REQUIRED' });
        return;
      }
      // Round up to 1 decimal, min 1 kg
      beratKg = Math.max(1, Math.ceil(beratRaw * 10) / 10);

      const rateSetting = await prisma.setting.findUnique({ where: { key: 'DEPOSIT_RATE' } });
      const ratePerKg = parseFloat(rateSetting?.value || '7000');
      biaya = beratKg * ratePerKg;

      if (customer.saldo < biaya) {
        res.status(402).json({
          error: `Saldo tidak cukup. Saldo: Rp ${customer.saldo.toLocaleString('id-ID')}, Biaya: Rp ${biaya.toLocaleString('id-ID')} (${beratKg} kg × Rp ${ratePerKg.toLocaleString('id-ID')})`,
          code: 'INSUFFICIENT_SALDO',
        });
        return;
      }
    } else {
      // ── BERLANGGANAN flow ────────────────────────────────────────────────────
      if (!customer.aktif) {
        res.status(403).json({
          error: `${customer.nama} (NIS: ${customer.nis}) tidak aktif berlangganan. Hubungi manager untuk mengaktifkan.`,
          code: 'CUSTOMER_INACTIVE',
        });
        return;
      }

      const weeklyLimitSetting = await prisma.setting.findUnique({ where: { key: 'WEEKLY_WASH_LIMIT' } });
      const weeklyLimit = parseInt(weeklyLimitSetting?.value || '2');

      const now = new Date();
      const dayOfWeek = now.getDay();
      const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + diffToMon);
      weekStart.setHours(0, 0, 0, 0);

      const resetAt = customer.weeklyWashResetAt;
      const needsReset = !resetAt || resetAt < weekStart;
      const currentCount = needsReset ? 0 : customer.weeklyWashCount;

      if (currentCount >= weeklyLimit) {
        res.status(429).json({
          error: `${customer.nama} sudah mencapai batas cuci pekan ini (${currentCount}/${weeklyLimit} kali). Limit direset setiap Senin.`,
          code: 'WEEKLY_LIMIT_EXCEEDED',
        });
        return;
      }

      // Store for post-create update
      (req as any).__weeklyMeta = { needsReset, currentCount, weekStart };
    }

    // Duplicate prevention: same customer within 15 min
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const dupOrder = await prisma.order.findFirst({
      where: { customerId, createdAt: { gte: fifteenMinAgo }, status: { not: 'PICKED_UP' } },
    });
    if (dupOrder) {
      res.status(409).json({
        error: `Order untuk ${customer.nama} (NIS: ${customer.nis}) sudah dibuat dalam 15 menit terakhir (${dupOrder.orderCode})`,
      });
      return;
    }

    const orderCode = await generateOrderCode(prisma, customer.nis);

    const completionDaysSetting = await prisma.setting.findUnique({ where: { key: 'COMPLETION_DAYS' } });
    const completionDays = parseInt(completionDaysSetting?.value || '3');
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + completionDays);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const trackUrl = `${frontendUrl}/track?order=${orderCode}`;
    const qrCode = await (QRCode as any).toDataURL(trackUrl, { 
      width: 500,
      margin: 2,
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95
    });

    const order = await prisma.order.create({
      data: {
        orderCode,
        qrCode,
        customerId: customer.id,
        notes: notes?.trim() || null,
        berat: beratKg,
        biaya,
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
      data: { orderId: order.id, fromStage: null, toStage: 'INTAKE', operatorId: req.user!.id },
    });

    await prisma.scanLog.create({
      data: { orderId: order.id, operatorId: req.user!.id, scanType: 'INTAKE_START', status: 'success' },
    });

    // Post-create: deduct saldo OR update weekly count
    if (customer.tipe === 'DEPOSIT') {
      const updated = await prisma.customer.update({
        where: { id: customer.id },
        data: { saldo: customer.saldo - biaya! },
      });
      (order.customer as any).saldo = updated.saldo;
    } else {
      const { needsReset, currentCount, weekStart } = (req as any).__weeklyMeta;
      const newCount = needsReset ? 1 : currentCount + 1;
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          weeklyWashCount: newCount,
          weeklyWashResetAt: needsReset ? weekStart : customer.weeklyWashResetAt,
        },
      });
      (order.customer as any).weeklyWashCount = newCount;
    }

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

    const order = await prisma.order.findUnique({ where: { id }, include: { customer: true } });
    if (!order) {
      res.status(404).json({ error: 'Order tidak ditemukan' });
      return;
    }

    if (order.status !== 'INTAKE') {
      res.status(400).json({ error: 'Order hanya bisa dihapus saat masih di status Penerimaan' });
      return;
    }

    const customer = order.customer;

    // Build refund update for customer
    let customerUpdate: Parameters<typeof prisma.customer.update>[0]['data'] | null = null;

    if (customer.tipe === 'DEPOSIT' && order.biaya != null) {
      customerUpdate = { saldo: customer.saldo + order.biaya };
    } else if (customer.tipe === 'BERLANGGANAN' && customer.weeklyWashCount > 0) {
      // Only decrement if the order was created within the current week window
      const inCurrentWeek =
        customer.weeklyWashResetAt != null && order.createdAt >= customer.weeklyWashResetAt;
      if (inCurrentWeek) {
        customerUpdate = { weeklyWashCount: customer.weeklyWashCount - 1 };
      }
    }

    await prisma.$transaction([
      prisma.scanLog.deleteMany({ where: { orderId: id } }),
      prisma.stageHistory.deleteMany({ where: { orderId: id } }),
      prisma.order.delete({ where: { id } }),
      ...(customerUpdate
        ? [prisma.customer.update({ where: { id: customer.id }, data: customerUpdate })]
        : []),
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
