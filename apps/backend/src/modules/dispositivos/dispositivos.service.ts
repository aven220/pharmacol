import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { SearchDispositivosDto } from './dto/search-dispositivos.dto';

const DISPOSITIVO_INCLUDE = {
  registroInvima: true,
  fabricante: true,
  importador: true,
  atributos: true,
} satisfies Prisma.DispositivoMedicoInclude;

@Injectable()
export class DispositivosService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchDispositivosDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;
    const q = dto.q?.trim();

    const where: Prisma.DispositivoMedicoWhereInput = {
      estadoRegistro: dto.soloVigentes !== false ? RegistrationStatus.VIGENTE : undefined,
    };

    if (q) {
      if (dto.tipo === 'registro') {
        where.registroInvima = { numeroRegistro: { contains: q, mode: 'insensitive' } };
      } else {
        where.OR = [
          { nombre: { contains: q, mode: 'insensitive' } },
          { registroInvima: { numeroRegistro: { contains: q, mode: 'insensitive' } } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.dispositivoMedico.findMany({
        where,
        include: DISPOSITIVO_INCLUDE,
        skip,
        take: limit,
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.dispositivoMedico.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async findById(id: string) {
    const item = await this.prisma.dispositivoMedico.findUnique({
      where: { id },
      include: DISPOSITIVO_INCLUDE,
    });
    if (!item) throw new NotFoundException('Dispositivo no encontrado');
    return item;
  }

  async findByRegistro(numero: string) {
    const item = await this.prisma.dispositivoMedico.findFirst({
      where: { registroInvima: { numeroRegistro: { equals: numero, mode: 'insensitive' } } },
      include: DISPOSITIVO_INCLUDE,
    });
    if (!item) throw new NotFoundException('Dispositivo no encontrado');
    return item;
  }
}
