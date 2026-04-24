import { PrismaClient } from '@prisma/client';

export async function generateOrderCode(prismaClient: PrismaClient, nis: string): Promise<string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const dateStr = `${dd}${mm}${yy}`;

  // NIS padded/trimmed to 10 digits
  const nisPart = nis.replace(/\D/g, '').slice(0, 10).padStart(10, '0');

  // Count orders this month for this customer
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthlyCount = await prismaClient.order.count({
    where: {
      customer: { nis },
      createdAt: { gte: startOfMonth, lte: endOfMonth },
    },
  });

  const seq = String(monthlyCount + 1).padStart(4, '0');
  return `${nisPart}${dateStr}${seq}`;
}
