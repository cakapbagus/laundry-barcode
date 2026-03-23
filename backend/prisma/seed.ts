import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();


async function main() {
  console.log('Seeding database...');

  // Create MANAGER
  const managerName = process.env.SEED_MANAGER_NAME || 'Admin';
  const managerPassword = process.env.SEED_MANAGER_PASSWORD || 'admin123';
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
    where: { key: 'COST_PER_KG' },
    update: {},
    create: { key: 'COST_PER_KG', value: '' },
  });

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
