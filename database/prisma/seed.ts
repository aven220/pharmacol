import { PrismaClient } from '@prisma/client';
import { seedAdminUser, seedAuditLog } from './seeds/admin-user';
import { seedAtcCodes } from './seeds/atc';
import { seedDemoData } from './seeds/demo-data';
import { seedDataSources } from './seeds/fuentes-datos';
import { seedRolesAndPermissions } from './seeds/roles-permissions';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 PharmaCol — Iniciando seed...\n');

  await seedRolesAndPermissions(prisma);
  await seedAtcCodes(prisma);
  await seedDataSources(prisma);
  await seedAdminUser(prisma);
  await seedDemoData(prisma);
  await seedAuditLog(prisma);

  console.log('\n✅ Seed completado exitosamente.');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
