import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}

export async function updateSetting(req: Request, res: Response): Promise<void> {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const allowedKeys = ['COMPLETION_DAYS', 'STUCK_HOURS', 'PRINT_COPIES', 'APP_TITLE', 'APP_SLOGAN', 'PAPER_WIDTH', 'WEEKLY_WASH_LIMIT', 'DEPOSIT_RATE'];
    if (!allowedKeys.includes(key)) {
      res.status(400).json({ error: 'Kunci setting tidak valid' });
      return;
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });

    res.json(setting);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
