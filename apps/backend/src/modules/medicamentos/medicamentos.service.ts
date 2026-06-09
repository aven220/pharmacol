import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityType, Prisma, RegistrationStatus, SearchType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { normalizeText, similarityScore } from '../../common/utils/text.util';
import { buildPresentacionesItems } from '../../common/utils/presentation.util';
import { HistorialService } from '../favoritos/favoritos.service';
import { SearchMedicamentosDto } from './dto/search-medicamentos.dto';

const MEDICAMENTO_INCLUDE = {
  laboratorio: true,
  titular: true,
  registroInvima: true,
  atc: true,
  principiosActivos: { include: { principioActivo: true } },
  presentaciones: true,
  codigosCum: true,
  codigosIum: true,
} satisfies Prisma.MedicamentoInclude;

const SUGGEST_SELECT = {
  id: true,
  nombreComercial: true,
  concentracion: true,
  formaFarmaceutica: true,
  estadoRegistro: true,
  laboratorio: { select: { razonSocial: true } },
  registroInvima: { select: { numeroRegistro: true } },
  codigosCum: { select: { codigoCompleto: true, consecutivo: true }, take: 1 },
  _count: { select: { codigosCum: true } },
} satisfies Prisma.MedicamentoSelect;

const PRESENTACIONES_SELECT = {
  id: true,
  nombreComercial: true,
  concentracion: true,
  formaFarmaceutica: true,
  estadoRegistro: true,
  laboratorio: { select: { razonSocial: true } },
  registroInvima: { select: { numeroRegistro: true, estado: true } },
  codigosCum: {
    select: {
      id: true,
      codigoCompleto: true,
      consecutivo: true,
      expedienteCum: true,
      estadoCum: true,
      descripcionProducto: true,
    },
    orderBy: { consecutivo: 'asc' as const },
  },
  presentaciones: {
    select: {
      id: true,
      descripcion: true,
      codigoCum: true,
      cantidad: true,
      unidad: true,
      codigoBarras: true,
    },
  },
} satisfies Prisma.MedicamentoSelect;

@Injectable()
export class MedicamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historial: HistorialService,
  ) {}

  async search(dto: SearchMedicamentosDto, userId?: string) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;
    const q = dto.q?.trim();

    const where: Prisma.MedicamentoWhereInput = {
      estadoRegistro: dto.soloVigentes !== false ? RegistrationStatus.VIGENTE : undefined,
    };

    if (q) {
      switch (dto.tipo) {
        case 'registro':
          where.registroInvima = {
            numeroRegistro: { contains: q, mode: 'insensitive' },
          };
          break;
        case 'cum':
          where.codigosCum = {
            some: { codigoCompleto: { contains: q, mode: 'insensitive' } },
          };
          break;
        case 'principio_activo':
          where.principiosActivos = {
            some: {
              principioActivo: {
                OR: [
                  { nombreNormalizado: { contains: normalizeText(q), mode: 'insensitive' } },
                  { nombreOficial: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          };
          break;
        case 'atc':
          where.atcCodigo = { startsWith: q.toUpperCase(), mode: 'insensitive' };
          break;
        case 'barcode':
          where.presentaciones = {
            some: { codigoBarras: { equals: q, mode: 'insensitive' } },
          };
          break;
        default: {
          const nq = normalizeText(q);
          where.OR = [
            { nombreNormalizado: { contains: nq, mode: 'insensitive' } },
            { nombreComercial: { contains: q, mode: 'insensitive' } },
            { registroInvima: { numeroRegistro: { contains: q, mode: 'insensitive' } } },
            {
              codigosCum: {
                some: { codigoCompleto: { contains: q, mode: 'insensitive' } },
              },
            },
            {
              principiosActivos: {
                some: {
                  principioActivo: {
                    OR: [
                      { nombreNormalizado: { contains: nq, mode: 'insensitive' } },
                      { nombreOficial: { contains: q, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          ];
        }
      }
    }

    const isNombreSearch = !dto.tipo || dto.tipo === 'nombre';

    if (isNombreSearch && q && q.length >= 2) {
      const fuzzyItems = await this.fuzzySearchByNombre(q, limit, skip);
      if (fuzzyItems.items.length > 0) {
        const result = paginate(fuzzyItems.items, fuzzyItems.total, page, limit);
        if (userId && q) {
          await this.historial.record(
            userId,
            SearchType.NOMBRE,
            q,
            fuzzyItems.items[0]?.id,
            EntityType.MEDICAMENTO,
          );
        }
        return result;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.medicamento.findMany({
        where,
        include: MEDICAMENTO_INCLUDE,
        skip,
        take: limit,
        orderBy: { nombreComercial: 'asc' },
      }),
      this.prisma.medicamento.count({ where }),
    ]);

    const result = paginate(items, total, page, limit);

    if (userId && q) {
      await this.historial.record(
        userId,
        this.mapSearchType(dto.tipo),
        q,
        items[0]?.id,
        EntityType.MEDICAMENTO,
      );
    }

    return result;
  }

  /** Autocompletado en tiempo real con similitud trigram + tolerancia a errores */
  async suggest(q: string, limit = 10) {
    const term = q?.trim();
    if (!term || term.length < 2) return { items: [], relacionados: [] };

    const normalized = normalizeText(term);
    const pattern = `%${normalized}%`;
    const prefix = `${normalized}%`;

    type SuggestRow = {
      id: string;
      nombreComercial: string;
      numeroRegistro: string | null;
      laboratorio: string | null;
      concentracion: string | null;
      formaFarmaceutica: string | null;
      estadoRegistro: string;
      numPresentaciones: number;
      score: number;
      matchType: string;
    };

    let rows: SuggestRow[] = [];

    try {
      rows = await this.prisma.$queryRaw<SuggestRow[]>`
        SELECT
          m.id,
          m.nombre_comercial AS "nombreComercial",
          ri.numero_registro AS "numeroRegistro",
          l.razon_social AS laboratorio,
          m.concentracion,
          m.forma_farmaceutica AS "formaFarmaceutica",
          m.estado_registro::text AS "estadoRegistro",
          (SELECT COUNT(*)::int FROM codigos_cum cc WHERE cc.medicamento_id = m.id) AS "numPresentaciones",
          GREATEST(
            similarity(m.nombre_normalizado, ${normalized}),
            CASE WHEN m.nombre_normalizado ILIKE ${prefix} THEN 0.95 ELSE 0 END,
            CASE WHEN m.nombre_normalizado ILIKE ${pattern} THEN 0.75 ELSE 0 END
          )::float AS score,
          'nombre' AS "matchType"
        FROM medicamentos m
        LEFT JOIN registros_invima ri ON ri.id = m.registro_invima_id
        LEFT JOIN laboratorios l ON l.id = m.laboratorio_id
        WHERE m.estado_registro = 'VIGENTE'
          AND (
            m.nombre_normalizado ILIKE ${pattern}
            OR similarity(m.nombre_normalizado, ${normalized}) > 0.2
          )
        ORDER BY score DESC, m.nombre_comercial ASC
        LIMIT ${limit}
      `;
    } catch {
      rows = [];
    }

    if (rows.length < limit) {
      const prismaRows = await this.prisma.medicamento.findMany({
        where: {
          estadoRegistro: RegistrationStatus.VIGENTE,
          OR: [
            { nombreNormalizado: { contains: normalized, mode: 'insensitive' } },
            { nombreComercial: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: SUGGEST_SELECT,
        take: limit * 2,
      });

      const existing = new Set(rows.map((r) => r.id));
      for (const m of prismaRows) {
        if (existing.has(m.id)) continue;
        const score = similarityScore(term, m.nombreComercial);
        if (score < 0.35) continue;
        rows.push({
          id: m.id,
          nombreComercial: m.nombreComercial,
          numeroRegistro: m.registroInvima?.numeroRegistro ?? null,
          laboratorio: m.laboratorio?.razonSocial ?? null,
          concentracion: m.concentracion,
          formaFarmaceutica: m.formaFarmaceutica,
          estadoRegistro: m.estadoRegistro,
          numPresentaciones: m._count.codigosCum,
          score,
          matchType: 'nombre',
        });
      }
      rows.sort((a, b) => b.score - a.score);
      rows = rows.slice(0, limit);
    }

    const relacionados = rows.length
      ? await this.findRelatedMedicamentos(rows[0].id, 4)
      : [];

    return {
      items: rows.map(({ score, matchType, ...rest }) => ({
        ...rest,
        score: Math.round(score * 100) / 100,
        matchType,
      })),
      relacionados,
    };
  }

  private async fuzzySearchByNombre(q: string, limit: number, skip: number) {
    const normalized = normalizeText(q);
    const pattern = `%${normalized}%`;
    const fetchLimit = Math.min(limit + skip + 20, 100);

    type FuzzyRow = { id: string; score: number };

    let ids: FuzzyRow[] = [];

    try {
      ids = await this.prisma.$queryRaw<FuzzyRow[]>`
        SELECT m.id, GREATEST(
          similarity(m.nombre_normalizado, ${normalized}),
          CASE WHEN m.nombre_normalizado ILIKE ${normalized + '%'} THEN 0.95 ELSE 0 END,
          CASE WHEN m.nombre_normalizado ILIKE ${pattern} THEN 0.7 ELSE 0 END
        )::float AS score
        FROM medicamentos m
        WHERE m.estado_registro = 'VIGENTE'
          AND (
            m.nombre_normalizado ILIKE ${pattern}
            OR similarity(m.nombre_normalizado, ${normalized}) > 0.2
          )
        ORDER BY score DESC, m.nombre_comercial ASC
        LIMIT ${fetchLimit}
      `;
    } catch {
      ids = [];
    }

    if (!ids.length) {
      const meds = await this.prisma.medicamento.findMany({
        where: {
          estadoRegistro: RegistrationStatus.VIGENTE,
          OR: [
            { nombreNormalizado: { contains: normalized, mode: 'insensitive' } },
            { nombreComercial: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, nombreComercial: true },
        take: fetchLimit,
      });
      ids = meds
        .map((m) => ({ id: m.id, score: similarityScore(q, m.nombreComercial) }))
        .filter((m) => m.score >= 0.35)
        .sort((a, b) => b.score - a.score);
    }

    const pageIds = ids.slice(skip, skip + limit).map((r) => r.id);
    if (!pageIds.length) return { items: [], total: 0 };

    const items = await this.prisma.medicamento.findMany({
      where: { id: { in: pageIds } },
      include: MEDICAMENTO_INCLUDE,
    });

    const orderMap = new Map(pageIds.map((id, i) => [id, i]));
    items.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    return { items, total: ids.length };
  }

  private async findRelatedMedicamentos(medicamentoId: string, limit: number) {
    const med = await this.prisma.medicamento.findUnique({
      where: { id: medicamentoId },
      include: {
        principiosActivos: { select: { principioActivoId: true } },
        laboratorio: { select: { id: true } },
      },
    });
    if (!med) return [];

    const principioIds = med.principiosActivos.map((p) => p.principioActivoId);
    const orConditions: Prisma.MedicamentoWhereInput[] = [];
    if (principioIds.length) {
      orConditions.push({
        principiosActivos: { some: { principioActivoId: { in: principioIds } } },
      });
    }
    if (med.laboratorioId) {
      orConditions.push({ laboratorioId: med.laboratorioId });
    }
    if (!orConditions.length) return [];

    const related = await this.prisma.medicamento.findMany({
      where: {
        id: { not: medicamentoId },
        estadoRegistro: RegistrationStatus.VIGENTE,
        OR: orConditions,
      },
      select: SUGGEST_SELECT,
      take: limit,
      orderBy: { nombreComercial: 'asc' },
    });

    return related.map((m) => ({
      id: m.id,
      nombreComercial: m.nombreComercial,
      numeroRegistro: m.registroInvima?.numeroRegistro,
      laboratorio: m.laboratorio?.razonSocial,
      concentracion: m.concentracion,
      formaFarmaceutica: m.formaFarmaceutica,
      estadoRegistro: m.estadoRegistro,
      numPresentaciones: m._count.codigosCum,
    }));
  }

  private mapSearchType(tipo?: string): SearchType {
    const map: Record<string, SearchType> = {
      nombre: SearchType.NOMBRE,
      principio_activo: SearchType.PRINCIPIO_ACTIVO,
      registro: SearchType.REGISTRO,
      cum: SearchType.CUM,
      atc: SearchType.ATC,
      barcode: SearchType.BARCODE,
      qr: SearchType.QR,
    };
    return map[tipo ?? 'nombre'] ?? SearchType.NOMBRE;
  }

  async findById(id: string) {
    const item = await this.prisma.medicamento.findUnique({
      where: { id },
      include: MEDICAMENTO_INCLUDE,
    });
    if (!item) throw new NotFoundException('Medicamento no encontrado');
    return item;
  }

  /** Listado rápido de presentaciones (CUM + consecutivos + embalaje) */
  async listPresentaciones(medicamentoId: string) {
    const med = await this.prisma.medicamento.findUnique({
      where: { id: medicamentoId },
      select: PRESENTACIONES_SELECT,
    });
    if (!med) throw new NotFoundException('Medicamento no encontrado');

    const presentaciones = buildPresentacionesItems(med);

    return {
      medicamento: {
        id: med.id,
        nombreComercial: med.nombreComercial,
        concentracion: med.concentracion,
        formaFarmaceutica: med.formaFarmaceutica,
        estadoRegistro: med.estadoRegistro,
        numeroRegistro: med.registroInvima?.numeroRegistro,
        laboratorio: med.laboratorio?.razonSocial,
      },
      presentaciones,
      total: presentaciones.length,
    };
  }

  async findByRegistro(numero: string) {
    const item = await this.prisma.medicamento.findFirst({
      where: { registroInvima: { numeroRegistro: { equals: numero, mode: 'insensitive' } } },
      include: MEDICAMENTO_INCLUDE,
    });
    if (!item) throw new NotFoundException('Medicamento no encontrado');
    return item;
  }

  async findByCum(codigo: string) {
    const cum = await this.prisma.codigoCum.findFirst({
      where: { codigoCompleto: { equals: codigo.trim(), mode: 'insensitive' } },
      include: { medicamento: { include: MEDICAMENTO_INCLUDE } },
    });
    if (!cum) throw new NotFoundException('CUM no encontrado');
    return cum.medicamento;
  }

  async findByBarcode(codigo: string) {
    const code = codigo.trim();
    const presentaciones = await this.prisma.presentacion.findMany({
      where: { codigoBarras: { equals: code, mode: 'insensitive' } },
      include: {
        medicamento: {
          select: PRESENTACIONES_SELECT,
        },
      },
    });
    if (!presentaciones.length) {
      throw new NotFoundException('Código de barras no encontrado');
    }

    const items = presentaciones.map((pres) => {
      const med = pres.medicamento;
      const allPresentaciones = buildPresentacionesItems(med);
      const match =
        allPresentaciones.find((p) => p.cum === pres.codigoCum) ??
        allPresentaciones.find((p) => p.id === pres.id) ??
        allPresentaciones[0];

      return {
        medicamentoId: med.id,
        presentacionId: pres.id,
        codigoBarras: pres.codigoBarras,
        nombreComercial: med.nombreComercial,
        concentracion: med.concentracion,
        formaFarmaceutica: med.formaFarmaceutica,
        laboratorio: med.laboratorio?.razonSocial,
        presentacionComercial: match?.presentacionComercial ?? med.nombreComercial,
        embalaje: match?.embalaje,
        cum: match?.cum ?? pres.codigoCum,
      };
    });

    return { items, total: items.length };
  }

  async offlinePack(page = 1, limit = 500) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.medicamento.findMany({
        where: { estadoRegistro: RegistrationStatus.VIGENTE },
        include: {
          registroInvima: { select: { numeroRegistro: true, fechaVencimiento: true, estado: true } },
          laboratorio: { select: { razonSocial: true } },
          codigosCum: { select: { codigoCompleto: true } },
          principiosActivos: { include: { principioActivo: { select: { nombreOficial: true } } } },
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.medicamento.count({ where: { estadoRegistro: RegistrationStatus.VIGENTE } }),
    ]);

    return {
      items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
      generatedAt: new Date().toISOString(),
    };
  }
}
