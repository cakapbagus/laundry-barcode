import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();


async function main() {
  console.log('Seeding database...');

  // Create MANAGER
  const managerName = process.env.SEED_MANAGER_NAME || 'manager';
  const managerPassword = process.env.SEED_MANAGER_PASSWORD || 'manager123';
  const managerHash = await bcrypt.hash(managerPassword, 10);
  const admin = await prisma.user.upsert({
    where: { name: managerName },
    update: {},
    create: { name: managerName, passwordHash: managerHash, role: 'MANAGER', active: true },
  });
  console.log('Created MANAGER:', admin.name);

  // Sample Machines
  const machine1 = await prisma.machine.upsert({
    where: { code: 'MESIN-01' },
    update: { category: 'WASH' },
    create: { code: 'MESIN-01', name: 'Mesin Cuci Front Load 1', category: 'WASH', active: true },
  });
  console.log('Created Machine:', machine1.name);

  const machine2 = await prisma.machine.upsert({
    where: { code: 'MESIN-02' },
    update: { category: 'DRY' },
    create: { code: 'MESIN-02', name: 'Mesin Pengering 1', category: 'DRY', active: true },
  });
  console.log('Created Machine:', machine2.name);

  const machine3 = await prisma.machine.upsert({
    where: { code: 'MESIN-03' },
    update: { category: 'IRON' },
    create: { code: 'MESIN-03', name: 'Meja Setrika 1', category: 'IRON', active: true },
  });
  console.log('Created Machine:', machine3.name);

  // Default settings
  await prisma.setting.upsert({
    where: { key: 'COMPLETION_DAYS' },
    update: {},
    create: { key: 'COMPLETION_DAYS', value: '3' },
  });

  await prisma.setting.upsert({
    where: { key: 'STUCK_THRESHOLD_HOURS' },
    update: {},
    create: { key: 'STUCK_THRESHOLD_HOURS', value: '2' },
  });

  await prisma.setting.upsert({
    where: { key: 'PRINT_COPIES' },
    update: {},
    create: { key: 'PRINT_COPIES', value: '2' },
  });

  await prisma.setting.upsert({
    where: { key: 'APP_TITLE' },
    update: {},
    create: { key: 'APP_TITLE', value: 'Laundry Pesantren' },
  });

  await prisma.setting.upsert({
    where: { key: 'APP_SLOGAN' },
    update: {},
    create: { key: 'APP_SLOGAN', value: 'Sistem Pelacak Cucian' },
  });

  await prisma.setting.upsert({
    where: { key: 'PAPER_WIDTH' },
    update: {},
    create: { key: 'PAPER_WIDTH', value: '80' },
  });

  // Remove legacy COST_PER_KG if present
  await prisma.setting.deleteMany({ where: { key: 'COST_PER_KG' } });

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
