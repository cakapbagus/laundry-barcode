import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function numberToBase26(n: number): string {
  // Converts 0 → AAA, 1 → AAB, ..., 25 → AAZ, 26 → ABA, ...
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  let num = n;
  for (let i = 0; i < 3; i++) {
    result = chars[num % 26] + result;
    num = Math.floor(num / 26);
  }
  return result;
}

export async function generateOrderCode(prismaClient: PrismaClient): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `LAU-${dateStr}-`;

  // Find all orders today
  const startOfDay = new Date(today.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const endOfDay = new Date(today.toISOString().slice(0, 10) + 'T23:59:59.999Z');

  const todayOrders = await prismaClient.order.findMany({
    where: {
      orderCode: { startsWith: prefix },
    },
    orderBy: { orderCode: 'desc' },
  });

  const count = todayOrders.length;
  const seq = numberToBase26(count);
  return `${prefix}${seq}`;
}
