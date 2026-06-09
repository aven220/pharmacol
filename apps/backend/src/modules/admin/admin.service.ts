import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { PaginationDto } from '../../common/dto/pagination-query.dto';
import { hashPassword } from '../../common/utils/crypto.util';
import { AuditService } from '../audit/audit.service';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/admin-users.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getDashboardStats() {
    const [
      usuarios,
      medicamentos,
      dispositivos,
      syncJobs,
      syncFallidos,
      consultasHoy,
      alertasAbiertas,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.medicamento.count(),
      this.prisma.dispositivoMedico.count(),
      this.prisma.syncJob.count(),
      this.prisma.syncJob.count({ where: { status: 'FALLIDA' } }),
      this.prisma.queryHistory.count({
        where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      }),
      this.prisma.alertaFalsificacion.count({ where: { nivelRiesgo: { in: ['CRITICO', 'ALTO'] } } }),
    ]);

    const ultimaSync = await this.prisma.syncJob.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { fuente: { select: { codigo: true, nombre: true } } },
    });

    return {
      usuarios,
      medicamentos,
      dispositivos,
      syncJobs,
      syncFallidos,
      consultasHoy,
      alertasAbiertas,
      ultimaSync,
    };
  }

  async listUsers(dto: PaginationDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          nombre: true,
          status: true,
          ultimoLoginAt: true,
          createdAt: true,
          roles: { include: { role: { select: { codigo: true, nombre: true } } } },
        },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return paginate(items, total, page, limit);
  }

  async listRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { codigo: 'asc' },
    });
  }

  async listAuditLogs(dto: PaginationDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, nombre: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return paginate(items, total, page, limit);
  }

  async listDataSources() {
    return this.prisma.dataSource.findMany({ orderBy: { codigo: 'asc' } });
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        roles: { include: { role: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  async createUser(dto: CreateAdminUserDto, adminId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('El email ya está registrado');
    }

    const roles = await this.prisma.role.findMany({
      where: { codigo: { in: dto.roleCodigos } },
    });
    if (roles.length !== dto.roleCodigos.length) {
      throw new BadRequestException('Uno o más roles no existen');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashPassword(dto.password),
        nombre: dto.nombre,
        telefono: dto.telefono,
        status: dto.status ?? UserStatus.ACTIVO,
        emailVerificadoAt: new Date(),
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        status: true,
        telefono: true,
        createdAt: true,
        roles: { include: { role: { select: { codigo: true, nombre: true } } } },
      },
    });

    await this.audit.log({
      userId: adminId,
      accion: 'CREATE',
      recurso: 'usuario',
      recursoId: user.id,
      metadata: { email: user.email },
    });

    return user;
  }

  async updateUser(id: string, dto: UpdateAdminUserDto, adminId?: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.email && dto.email !== user.email) {
      const dup = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (dup && dup.id !== id) throw new ConflictException('El email ya está en uso');
    }

    if (dto.roleCodigos?.length) {
      const roles = await this.prisma.role.findMany({
        where: { codigo: { in: dto.roleCodigos } },
      });
      if (roles.length !== dto.roleCodigos.length) {
        throw new BadRequestException('Uno o más roles no existen');
      }
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.userRole.createMany({
        data: roles.map((r) => ({ userId: id, roleId: r.id })),
      });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        nombre: dto.nombre,
        telefono: dto.telefono,
        status: dto.status,
        ...(dto.password ? { passwordHash: hashPassword(dto.password) } : {}),
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        status: true,
        telefono: true,
        updatedAt: true,
        roles: { include: { role: { select: { codigo: true, nombre: true } } } },
      },
    });

    await this.audit.log({
      userId: adminId,
      accion: 'UPDATE',
      recurso: 'usuario',
      recursoId: id,
    });

    return updated;
  }

  async deleteUser(id: string, adminId?: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: UserStatus.INACTIVO },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      userId: adminId,
      accion: 'DELETE',
      recurso: 'usuario',
      recursoId: id,
    });

    return { ok: true };
  }
}
