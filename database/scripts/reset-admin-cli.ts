/**
 * Restablece solo el usuario admin (sin demo data ni sync pesado).
 * Uso: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... tsx scripts/reset-admin-cli.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedAdminUser } from '../prisma/seeds/admin-user';
import { seedDataSources } from '../prisma/seeds/fuentes-datos';
import { seedRolesAndPermissions } from '../prisma/seeds/roles-permissions';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedRolesAndPermissions(prisma);
    await seedDataSources(prisma);
    await seedAdminUser(prisma);

    const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@pharmacol.co';
    await prisma.user.updateMany({
      where: { email },
      data: {
        status: 'ACTIVO',
        intentosFallidos: 0,
        bloqueadoHasta: null,
        emailVerificadoAt: new Date(),
      },
    });

    console.log(`✓ Admin restablecido: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('✗ reset-admin-cli:', err);
  process.exit(1);
});
