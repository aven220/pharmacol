import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AlertasSanitariasService {
  constructor(private readonly prisma: PrismaService) {}

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
}
