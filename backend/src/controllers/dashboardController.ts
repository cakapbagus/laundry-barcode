import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const monthParam = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const [year, month] = monthParam.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const [monthOrders, costSetting] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
        include: {
          history: {
            where: { toStage: { in: ['WASHING', 'FINISHED'] } },
            select: { toStage: true, startedAt: true },
          },
        },
      }),
      prisma.setting.findUnique({ where: { key: 'COST_PER_KG' } }),
    ]);

    const totalOrders = monthOrders.length;
    const totalWeight = monthOrders.reduce((sum, o) => sum + o.weightKg, 0);
    const finishedOrders = monthOrders.filter(
      (o) => o.status === 'FINISHED' || o.status === 'PICKED_UP'
    );
    const percentComplete =
      totalOrders > 0 ? Math.round((finishedOrders.length / totalOrders) * 100) : 0;

    const costPerKg = costSetting?.value ? parseFloat(costSetting.value) : null;
    const estimatedRevenue = costPerKg ? totalWeight * costPerKg : null;

    // Average time from WASHING start to FINISHED start (in seconds)
    const cycleEntries = monthOrders
      .map((o) => {
        const washing = o.history.find((h) => h.toStage === 'WASHING');
        const finished = o.history.find((h) => h.toStage === 'FINISHED');
        if (!washing || !finished) return null;
        return (finished.startedAt.getTime() - washing.startedAt.getTime()) / 1000;
      })
      .filter((v): v is number => v !== null);

    const avgCycleTime =
      cycleEntries.length > 0
        ? Math.floor(cycleEntries.reduce((sum, v) => sum + v, 0) / cycleEntries.length)
        : 0;

    res.json({
      totalOrders,
      totalWeight,
      estimatedRevenue,
      percentComplete,
      avgCycleTime,
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function getOrdersByStatus(req: Request, res: Response): Promise<void> {
  try {
    const monthParam = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const [year, month] = monthParam.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const where: any = {
      OR: [
        // Order aktif (belum selesai) selalu muncul, tanpa filter bulan
        { status: { notIn: ['FINISHED', 'PICKED_UP'] } },
        // Order selesai hanya dari bulan yang dipilih
        {
          status: { in: ['FINISHED', 'PICKED_UP'] },
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      ],
    };

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        history: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: {
            operator: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Group by status
    const stages = ['INTAKE', 'WASHING', 'DRYING', 'IRONING', 'PACKING', 'FINISHED', 'PICKED_UP'];
    const grouped: Record<string, any[]> = {};
    for (const stage of stages) {
      grouped[stage] = orders.filter((o) => o.status === stage);
    }

    res.json(grouped);
  } catch (error) {
    console.error('Orders by status error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function getDailyReport(req: Request, res: Response): Promise<void> {
  try {
    const monthParam = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const [year, month] = monthParam.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const [orders, costSetting] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
        include: {
          customer: true,
          createdBy: { select: { id: true, name: true } },
          history: {
            include: { operator: { select: { id: true, name: true } } },
            orderBy: { startedAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.setting.findUnique({ where: { key: 'COST_PER_KG' } }),
    ]);

    const totalWeight = orders.reduce((sum, o) => sum + o.weightKg, 0);
    const costPerKg = costSetting?.value ? parseFloat(costSetting.value) : null;
    const totalRevenue = costPerKg ? totalWeight * costPerKg : null;

    res.json({
      date: monthParam,
      totalOrders: orders.length,
      totalWeight,
      totalRevenue,
      orders,
    });
  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
