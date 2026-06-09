/** Repuebla solo fuentes INVIMA (data_sources). */
import { PrismaClient } from '@prisma/client';
import { seedDataSources } from '../prisma/seeds/fuentes-datos';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedDataSources(prisma);
    console.log('✓ Fuentes INVIMA listas');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('✗ seed-fuentes-cli:', err);
  process.exit(1);
});
