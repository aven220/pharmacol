import type { PrismaClient } from '@prisma/client';

export const ROLES = [
  {
    codigo: 'ADMINISTRADOR',
    nombre: 'Administrador',
    descripcion: 'Acceso total al sistema y configuración',
  },
  {
    codigo: 'SUPERVISOR',
    nombre: 'Supervisor',
    descripcion: 'Gestión operativa, sync y auditoría',
  },
  {
    codigo: 'FARMACEUTICO',
    nombre: 'Farmacéutico',
    descripcion: 'Consultas avanzadas, OCR e IA',
  },
  {
    codigo: 'REGENTE',
    nombre: 'Regente',
    descripcion: 'Consultas avanzadas, OCR e IA en farmacia',
  },
  {
    codigo: 'CONSULTA',
    nombre: 'Consulta',
    descripcion: 'Consultas básicas autenticadas',
  },
  {
    codigo: 'INVITADO',
    nombre: 'Invitado',
    descripcion: 'Consultas limitadas sin autenticación completa',
  },
] as const;

export const PERMISSIONS = [
  { codigo: 'medicamentos:read', recurso: 'medicamentos', accion: 'read', descripcion: 'Consultar medicamentos' },
  { codigo: 'medicamentos:advanced', recurso: 'medicamentos', accion: 'advanced', descripcion: 'Consultas avanzadas' },
  { codigo: 'dispositivos:read', recurso: 'dispositivos', accion: 'read', descripcion: 'Consultar dispositivos médicos' },
  { codigo: 'ocr:use', recurso: 'ocr', accion: 'use', descripcion: 'Usar OCR' },
  { codigo: 'ia:use', recurso: 'ia', accion: 'use', descripcion: 'Usar identificación IA' },
  { codigo: 'antifalsificacion:view', recurso: 'antifalsificacion', accion: 'view', descripcion: 'Ver alertas antifalsificación' },
  { codigo: 'favoritos:manage', recurso: 'favoritos', accion: 'manage', descripcion: 'Gestionar favoritos' },
  { codigo: 'historial:own', recurso: 'historial', accion: 'own', descripcion: 'Ver historial propio' },
  { codigo: 'sync:execute', recurso: 'sync', accion: 'execute', descripcion: 'Ejecutar sincronización manual' },
  { codigo: 'sync:view', recurso: 'sync', accion: 'view', descripcion: 'Ver estado de sincronizaciones' },
  { codigo: 'users:manage', recurso: 'users', accion: 'manage', descripcion: 'Gestionar usuarios' },
  { codigo: 'roles:manage', recurso: 'roles', accion: 'manage', descripcion: 'Gestionar roles y permisos' },
  { codigo: 'audit:view', recurso: 'audit', accion: 'view', descripcion: 'Ver auditoría' },
  { codigo: 'dashboard:view', recurso: 'dashboard', accion: 'view', descripcion: 'Ver dashboard administrativo' },
] as const;

/** Matriz rol → permisos (codigos) */
export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  ADMINISTRADOR: PERMISSIONS.map((p) => p.codigo),
  SUPERVISOR: [
    'medicamentos:read', 'medicamentos:advanced', 'dispositivos:read',
    'ocr:use', 'ia:use', 'antifalsificacion:view', 'favoritos:manage',
    'historial:own', 'sync:execute', 'sync:view', 'audit:view', 'dashboard:view',
  ],
  FARMACEUTICO: [
    'medicamentos:read', 'medicamentos:advanced', 'dispositivos:read',
    'ocr:use', 'ia:use', 'antifalsificacion:view', 'favoritos:manage', 'historial:own',
  ],
  REGENTE: [
    'medicamentos:read', 'medicamentos:advanced', 'dispositivos:read',
    'ocr:use', 'ia:use', 'antifalsificacion:view', 'favoritos:manage', 'historial:own',
  ],
  CONSULTA: [
    'medicamentos:read', 'dispositivos:read', 'favoritos:manage', 'historial:own',
  ],
  INVITADO: ['medicamentos:read', 'dispositivos:read'],
};

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

  const allRoles = await prisma.role.findMany();
  const allPerms = await prisma.permission.findMany();
  const permByCode = Object.fromEntries(allPerms.map((p) => [p.codigo, p.id]));
  const roleByCode = Object.fromEntries(allRoles.map((r) => [r.codigo, r.id]));

  for (const [roleCodigo, permCodigos] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleByCode[roleCodigo];
    if (!roleId) continue;

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
