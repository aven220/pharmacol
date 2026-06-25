import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SyncService } from '../sync/sync.service';

/** Máximo de sincronizaciones de alertas por regente y día */
export const REGENTE_ALERTAS_SYNC_MAX_PER_DAY = 2;

@Injectable()
export class AlertasSanitariasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
    private readonly audit: AuditService,
  ) {}

  async search(q?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const term = q?.trim();

    const where = term
      ? {
          OR: [
            { titulo: { contains: term, mode: 'insensitive' as const } },
            { descripcion: { contains: term, mode: 'insensitive' as const } },
            { numeroAlerta: { contains: term, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.alertaSanitaria.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ fechaAlerta: 'desc' }, { numeroAlerta: 'desc' }],
      }),
      this.prisma.alertaSanitaria.count({ where }),
    ]);

    return { items, meta: { total, page, limit } };
  }

  async findById(id: string) {
    const alerta = await this.prisma.alertaSanitaria.findUnique({ where: { id } });
    if (!alerta) throw new NotFoundException('Alerta sanitaria no encontrada');
    return alerta;
  }

  async recent(limit = 10) {
    return this.prisma.alertaSanitaria.findMany({
      take: limit,
      orderBy: [{ fechaAlerta: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async stats() {
    const [total, ultimaSync] = await Promise.all([
      this.prisma.alertaSanitaria.count(),
      this.prisma.syncJob.findFirst({
        where: { fuente: { codigo: 'INVIMA_ALERTAS_SANITARIAS' } },
        orderBy: { createdAt: 'desc' },
        include: { fuente: true },
      }),
    ]);
    return { total, ultimaSync };
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async countRegenteSyncAttemptsToday(userId: string): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        userId,
        accion: 'SYNC_ALERTAS',
        createdAt: { gte: this.startOfToday() },
      },
    });
  }

  async getSyncCuota(userId: string, roles: string[]) {
    if (roles.includes('ADMINISTRADOR')) {
      return {
        ilimitado: true,
        max: null as number | null,
        usado: 0,
        restante: null as number | null,
      };
    }

    const usado = await this.countRegenteSyncAttemptsToday(userId);
    return {
      ilimitado: false,
      max: REGENTE_ALERTAS_SYNC_MAX_PER_DAY,
      usado,
      restante: Math.max(0, REGENTE_ALERTAS_SYNC_MAX_PER_DAY - usado),
    };
  }

  async sincronizarPortal(userId: string, roles: string[]) {
    const isAdmin = roles.includes('ADMINISTRADOR');

    if (!isAdmin) {
      const usado = await this.countRegenteSyncAttemptsToday(userId);
      if (usado >= REGENTE_ALERTAS_SYNC_MAX_PER_DAY) {
        throw new ForbiddenException(
          `Límite diario alcanzado: máximo ${REGENTE_ALERTAS_SYNC_MAX_PER_DAY} sincronizaciones por día`,
        );
      }
    }

    const result = await this.sync.executeManual('INVIMA_ALERTAS_PORTAL', userId, false);

    if (!isAdmin) {
      await this.audit.log({
        userId,
        accion: 'SYNC_ALERTAS',
        recurso: 'alertas',
        metadata: {
          fuente: 'INVIMA_ALERTAS_PORTAL',
          inserted: result.inserted,
          updated: result.updated,
          persisted: result.persisted,
        },
      });
    }

    return result;
  }
}
