import { Injectable } from '@nestjs/common';
import { EntityType, SearchType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateFavoriteDto } from './dto/favoritos.dto';
import { PaginationDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class FavoritosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, dto: PaginationDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.favorite.count({ where: { userId } }),
    ]);

    return paginate(items, total, page, limit);
  }

  async add(userId: string, dto: CreateFavoriteDto) {
    return this.prisma.favorite.upsert({
      where: {
        userId_entidadTipo_entidadId: {
          userId,
          entidadTipo: dto.entidadTipo,
          entidadId: dto.entidadId,
        },
      },
      update: { notas: dto.notas },
      create: {
        userId,
        entidadTipo: dto.entidadTipo,
        entidadId: dto.entidadId,
        notas: dto.notas,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.prisma.favorite.deleteMany({ where: { id, userId } });
    return { deleted: true };
  }
}

@Injectable()
export class HistorialService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, dto: PaginationDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.queryHistory.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.queryHistory.count({ where: { userId } }),
    ]);

    return paginate(items, total, page, limit);
  }

  async record(
    userId: string,
    tipo: SearchType,
    query: string,
    resultadoId?: string,
    entidadTipo?: EntityType,
  ) {
    const safeQuery = query.length > 500 ? `${query.slice(0, 497)}...` : query;
    return this.prisma.queryHistory.create({
      data: { userId, tipoBusqueda: tipo, query: safeQuery, resultadoId, entidadTipo },
    });
  }
}
