import type { PrismaClient } from '@prisma/client';
import { UserStatus } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export async function seedAdminUser(prisma: PrismaClient): Promise<void> {
  console.log('  → Usuario administrador...');

  const adminRole = await prisma.role.findUnique({ where: { codigo: 'ADMINISTRADOR' } });
  if (!adminRole) {
    throw new Error('Rol ADMINISTRADOR no encontrado. Ejecutar seedRolesAndPermissions primero.');
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@pharmacol.co';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      status: UserStatus.ACTIVO,
      emailVerificadoAt: new Date(),
      passwordHash: hashPassword(password),
    },
    create: {
      email,
      passwordHash: hashPassword(password),
      nombre: 'Administrador PharmaCol',
      status: UserStatus.ACTIVO,
      emailVerificadoAt: new Date(),
      roles: {
        create: { roleId: adminRole.id },
      },
    },
  });

  // Asegurar rol asignado si el usuario ya existía
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });

  console.log(`    ✓ Admin: ${email}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log('    ⚠ Password de prueba: admin123 (cambiar en producción)');
  }
}

export async function seedAuditLog(prisma: PrismaClient): Promise<void> {
  console.log('  → Registro auditoría inicial...');

  const count = await prisma.auditLog.count();
  if (count > 0) return;

  await prisma.auditLog.create({
    data: {
      accion: 'SEED_COMPLETED',
      recurso: 'database',
      metadata: {
        version: '0.1.0',
        fase: 2,
        timestamp: new Date().toISOString(),
      },
    },
  });
}
