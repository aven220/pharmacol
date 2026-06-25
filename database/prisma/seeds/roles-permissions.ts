import type { PrismaClient } from '@prisma/client';

/** Roles activos en el sistema */
export const ACTIVE_ROLE_CODES = ['ADMINISTRADOR', 'REGENTE'] as const;

const DEPRECATED_ROLE_CODES = ['SUPERVISOR', 'FARMACEUTICO', 'CONSULTA', 'INVITADO'] as const;

export const ROLES = [
  {
    codigo: 'ADMINISTRADOR',
    nombre: 'Administrador',
    descripcion: 'Acceso total: usuarios, sincronización, dashboard y actividad',
  },
  {
    codigo: 'REGENTE',
    nombre: 'Regente',
    descripcion: 'Consulta de medicamentos y alertas sanitarias INVIMA',
  },
] as const;

export const PERMISSIONS = [
  { codigo: 'medicamentos:read', recurso: 'medicamentos', accion: 'read', descripcion: 'Consultar medicamentos' },
  { codigo: 'medicamentos:advanced', recurso: 'medicamentos', accion: 'advanced', descripcion: 'Consultas avanzadas' },
  { codigo: 'dispositivos:read', recurso: 'dispositivos', accion: 'read', descripcion: 'Consultar dispositivos médicos' },
  { codigo: 'ocr:use', recurso: 'ocr', accion: 'use', descripcion: 'Usar OCR' },
  { codigo: 'ia:use', recurso: 'ia', accion: 'use', descripcion: 'Usar identificación IA' },
  { codigo: 'antifalsificacion:view', recurso: 'antifalsificacion', accion: 'view', descripcion: 'Ver alertas antifalsificación' },
  { codigo: 'alertas:view', recurso: 'alertas', accion: 'view', descripcion: 'Consultar alertas sanitarias INVIMA' },
  { codigo: 'alertas:sync', recurso: 'alertas', accion: 'sync', descripcion: 'Sincronizar alertas INVIMA (límite diario)' },
  { codigo: 'favoritos:manage', recurso: 'favoritos', accion: 'manage', descripcion: 'Gestionar favoritos' },
  { codigo: 'historial:own', recurso: 'historial', accion: 'own', descripcion: 'Ver historial propio' },
  { codigo: 'sync:execute', recurso: 'sync', accion: 'execute', descripcion: 'Ejecutar sincronización manual' },
  { codigo: 'sync:view', recurso: 'sync', accion: 'view', descripcion: 'Ver estado de sincronizaciones' },
  { codigo: 'users:manage', recurso: 'users', accion: 'manage', descripcion: 'Gestionar usuarios' },
  { codigo: 'roles:manage', recurso: 'roles', accion: 'manage', descripcion: 'Gestionar roles y permisos' },
  { codigo: 'audit:view', recurso: 'audit', accion: 'view', descripcion: 'Ver actividad de usuarios' },
  { codigo: 'dashboard:view', recurso: 'dashboard', accion: 'view', descripcion: 'Ver dashboard administrativo' },
] as const;

/** Matriz rol → permisos (codigos) */
export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  ADMINISTRADOR: PERMISSIONS.map((p) => p.codigo),
  REGENTE: ['medicamentos:read', 'alertas:view', 'alertas:sync'],
};

async function migrateDeprecatedRoles(prisma: PrismaClient): Promise<void> {
  const regente = await prisma.role.findUnique({ where: { codigo: 'REGENTE' } });
  if (!regente) return;

  const deprecated = await prisma.role.findMany({
    where: { codigo: { in: [...DEPRECATED_ROLE_CODES] } },
  });

  for (const role of deprecated) {
    const assignments = await prisma.userRole.findMany({ where: { roleId: role.id } });
    for (const ur of assignments) {
      const alreadyRegente = await prisma.userRole.findFirst({
        where: { userId: ur.userId, roleId: regente.id },
      });
      if (!alreadyRegente) {
        await prisma.userRole.create({ data: { userId: ur.userId, roleId: regente.id } });
      }
      await prisma.userRole.delete({
        where: { userId_roleId: { userId: ur.userId, roleId: role.id } },
      });
    }
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  }
}

async function syncRolePermissions(prisma: PrismaClient): Promise<void> {
  const allRoles = await prisma.role.findMany();
  const allPerms = await prisma.permission.findMany();
  const permByCode = Object.fromEntries(allPerms.map((p) => [p.codigo, p.id]));
  const roleByCode = Object.fromEntries(allRoles.map((r) => [r.codigo, r.id]));

  for (const [roleCodigo, permCodigos] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleByCode[roleCodigo];
    if (!roleId) continue;

    const desired = new Set(permCodigos);
    const current = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });

    for (const rp of current) {
      if (!desired.has(rp.permission.codigo)) {
        await prisma.rolePermission.delete({
          where: { roleId_permissionId: { roleId, permissionId: rp.permissionId } },
        });
      }
    }

    for (const permCodigo of permCodigos) {
      const permissionId = permByCode[permCodigo];
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }
}

export async function seedRolesAndPermissions(prisma: PrismaClient): Promise<void> {
  console.log('  → Roles y permisos...');

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { codigo: perm.codigo },
      update: { descripcion: perm.descripcion },
      create: perm,
    });
  }

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { codigo: role.codigo },
      update: { nombre: role.nombre, descripcion: role.descripcion },
      create: role,
    });
  }

  await migrateDeprecatedRoles(prisma);
  await syncRolePermissions(prisma);
}
