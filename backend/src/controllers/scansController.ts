import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { isValidTransition, getNextStage } from '../utils/stageFlow';
import { getIo } from '../server';

const prisma = new PrismaClient();

export async function stageTransition(req: Request, res: Response): Promise<void> {
  try {
    const { orderCode, machineId, notes } = req.body;

    if (!orderCode) {
      res.status(400).json({ error: 'Kode order wajib diisi' });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { orderCode },
      include: {
        history: { orderBy: { startedAt: 'desc' }, take: 1 },
      },
    });

    if (!order) {
      await prisma.scanLog.create({
        data: {
          orderId: 'unknown',
          operatorId: req.user!.id,
          scanType: 'STAGE_TRANSITION',
          status: 'error',
          errorMsg: `Order ${orderCode} tidak ditemukan`,
        },
      }).catch(() => {});
      res.status(404).json({ error: 'Order tidak ditemukan' });
      return;
    }

    if (order.status === 'PICKED_UP') {
      await prisma.scanLog.create({
        data: {
          orderId: order.id,
          operatorId: req.user!.id,
          scanType: 'STAGE_TRANSITION',
          status: 'error',
          errorMsg: 'Order sudah diambil',
        },
      });
      res.status(400).json({ error: 'Order sudah diambil, tidak bisa diproses lagi' });
      return;
    }

    const nextStage = getNextStage(order.status);
    if (!nextStage) {
      res.status(400).json({ error: 'Order sudah pada tahap akhir' });
      return;
    }

    if (!isValidTransition(order.status, nextStage)) {
      res.status(400).json({ error: 'Transisi tahap tidak valid' });
      return;
    }

    // Hanya KASIR atau MANAGER yang bisa memproses pengambilan
    if (nextStage === 'PICKED_UP' && req.user!.role === 'OPERATOR') {
      res.status(403).json({ error: 'Hanya Kasir atau Manager yang dapat memproses pengambilan cucian' });
      return;
    }

    // Mapping stage → kategori mesin yang dibutuhkan
    const STAGE_CATEGORY: Record<string, string> = {
      WASHING: 'WASH',
      DRYING:  'DRY',
      IRONING: 'IRON',
    };
    const requiredCategory = STAGE_CATEGORY[nextStage];

    // Tahap yang butuh mesin: WASHING, DRYING, IRONING
    if (requiredCategory && !machineId) {
      res.status(400).json({ error: 'Pemilihan mesin wajib untuk tahap ini' });
      return;
    }

    // Validasi kategori mesin sesuai tahap
    if (requiredCategory && machineId) {
      const machine = await prisma.machine.findUnique({ where: { id: machineId } });
      if (!machine) {
        res.status(404).json({ error: 'Mesin tidak ditemukan' });
        return;
      }
      if (machine.category !== requiredCategory) {
        res.status(400).json({
          error: `Tahap ${nextStage} hanya bisa menggunakan mesin kategori ${requiredCategory}`,
        });
        return;
      }
      if (!machine.active) {
        res.status(400).json({ error: 'Mesin tidak aktif, pilih mesin lain' });
        return;
      }
    }

    // Close previous stage history
    const lastHistory = order.history[0];
    if (lastHistory && !lastHistory.endedAt) {
      const duration = Math.floor((Date.now() - lastHistory.startedAt.getTime()) / 1000);
      await prisma.stageHistory.update({
        where: { id: lastHistory.id },
        data: {
          endedAt: new Date(),
          duration,
        },
      });
    }

    // Create new stage history
    await prisma.stageHistory.create({
      data: {
        orderId: order.id,
        fromStage: order.status,
        toStage: nextStage,
        machineId: machineId || null,
        operatorId: req.user!.id,
        notes: notes || null,
      },
    });

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: nextStage,
        completedAt: nextStage === 'PICKED_UP' ? new Date() : undefined,
      },
      include: {
        customer: true,
        history: {
          include: { operator: { select: { id: true, name: true } } },
          orderBy: { startedAt: 'asc' },
        },
      },
    });

    // Log success scan
    await prisma.scanLog.create({
      data: {
        orderId: order.id,
        operatorId: req.user!.id,
        scanType: nextStage === 'PICKED_UP' ? 'PICKED_UP' : 'STAGE_TRANSITION',
        status: 'success',
      },
    });

    // Broadcast via WebSocket
    try {
      const io = getIo();
      io.emit('order:stage_updated', updatedOrder);
      io.emit('dashboard:refresh');
    } catch {}

    res.json({
      success: true,
      order: updatedOrder,
      transition: { from: order.status, to: nextStage },
    });
  } catch (error) {
    console.error('Stage transition error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function integrityCheck(req: Request, res: Response): Promise<void> {
  try {
    const { orderCode } = req.body;

    if (!orderCode) {
      res.status(400).json({ error: 'Kode order wajib diisi' });
      return;
    }

    let order;

    // Jika input berupa angka saja → cari berdasarkan NIS, fallback noHape
    if (/^\d+$/.test(orderCode.trim())) {
      const input = orderCode.trim();
      let customer = await prisma.customer.findUnique({ where: { nis: input } });
      if (!customer) {
        customer = await prisma.customer.findFirst({ where: { noHape: input } });
      }
      if (!customer) {
        res.json({ valid: false, error: `Santri dengan NIS / No HP ${input} tidak ditemukan` });
        return;
      }
      // Ambil order aktif (non-PICKED_UP) terbaru
      order = await prisma.order.findFirst({
        where: { customerId: customer.id, status: { not: 'PICKED_UP' } },
        include: { customer: true, history: { orderBy: { startedAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
      });
      if (!order) {
        res.json({ valid: false, error: `Tidak ada order aktif untuk santri ${customer.nama} (NIS: ${customer.nis})` });
        return;
      }
    } else {
      order = await prisma.order.findUnique({
        where: { orderCode },
        include: {
          customer: true,
          history: { orderBy: { startedAt: 'desc' }, take: 1 },
        },
      });
    }

    if (!order) {
      res.json({ valid: false, error: 'Order tidak ditemukan' });
      return;
    }

    const nextStage = getNextStage(order.status);

    res.json({
      valid: true,
      order: {
        id: order.id,
        orderCode: order.orderCode,
        customer: order.customer,
        status: order.status,
        nextStage,
        estimatedCompletion: order.estimatedCompletion,
      },
      isDuplicate: false,
      duplicateWarning: null,
    });
  } catch (error) {
    console.error('Integrity check error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
