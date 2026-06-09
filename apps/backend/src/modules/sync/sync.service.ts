import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import {
  DataOrigin,
  LaboratoryType,
  ProductType,
  RegistrationStatus,
  SyncJobStatus,
  SyncJobType,
  SyncRecordAction,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { extractEmbalaje } from '../../common/utils/presentation.util';

interface SocrataRecord {
  registrosanitario?: string;
  expedientecum?: string;
  consecutivocum?: string;
  producto?: string;
  descripcioncomercial?: string;
  cantidadcum?: string;
  principioactivo?: string;
  concentracion?: string;
  formafarmaceutica?: string;
  titular?: string;
  fabricante?: string;
  importador?: string;
  estadoregistro?: string;
  fechaexpedicion?: string;
  fechavencimiento?: string;
  estadocum?: string;
}

interface SyncProgress {
  read: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

function pickField(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = record[key];
    if (val != null && String(val).trim() && String(val).toLowerCase() !== 'null') {
      return String(val).trim();
    }
  }
  return undefined;
}

function normalizeCumRecord(raw: Record<string, unknown>): SocrataRecord {
  return {
    registrosanitario: pickField(raw, 'registrosanitario', 'registro_sanitario'),
    expedientecum: pickField(raw, 'expedientecum', 'expediente_cum', 'expediente'),
    consecutivocum: pickField(raw, 'consecutivocum', 'consecutivo_cum', 'consecutivocum'),
    producto: pickField(raw, 'producto', 'prodcuto'),
    descripcioncomercial: pickField(raw, 'descripcioncomercial', 'descripcion_comercial'),
    cantidadcum: pickField(raw, 'cantidadcum', 'cantidad_cum'),
    principioactivo: pickField(raw, 'principioactivo', 'principio_activo'),
    concentracion: pickField(raw, 'concentracion'),
    formafarmaceutica: pickField(raw, 'formafarmaceutica', 'forma_farmaceutica'),
    titular: pickField(raw, 'titular'),
    fabricante: pickField(raw, 'fabricante'),
    importador: pickField(raw, 'importador'),
    estadoregistro: pickField(raw, 'estadoregistro', 'estado_registro'),
    fechaexpedicion: pickField(raw, 'fechaexpedicion', 'fecha_expedicion'),
    fechavencimiento: pickField(raw, 'fechavencimiento', 'fecha_vencimiento'),
    estadocum: pickField(raw, 'estadocum', 'estado_cum'),
  };
}

interface DispositivoRecord {
  registrosanitario?: string;
  producto?: string;
  titular?: string;
  estadoregistro?: string;
  fechavencimiento?: string;
  categoria?: string;
  nivelRiesgo?: string;
}

function normalizeDispositivoRecord(raw: Record<string, unknown>): DispositivoRecord {
  return {
    registrosanitario: pickField(raw, 'registro_sanitario', 'registrosanitario'),
    producto: pickField(raw, 'prodcuto', 'producto'),
    titular: pickField(raw, 'titular'),
    estadoregistro: pickField(raw, 'estado_registro', 'estadoregistro'),
    fechavencimiento: pickField(raw, 'fecha_vencimiento', 'fechavencimiento'),
    categoria: pickField(raw, 'grupo', 'categoria'),
    nivelRiesgo: pickField(raw, 'nivel_riesgo', 'nivelriesgo'),
  };
}

function normalize(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function mapEstado(estado?: string): RegistrationStatus {
  const e = normalize(estado);
  if (e.includes('vigente')) return RegistrationStatus.VIGENTE;
  if (e.includes('vencido')) return RegistrationStatus.VENCIDO;
  if (e.includes('cancelado')) return RegistrationStatus.CANCELADO;
  if (e.includes('suspendido')) return RegistrationStatus.SUSPENDIDO;
  if (e.includes('tramite')) return RegistrationStatus.TRAMITE;
  return RegistrationStatus.OTRO;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async listJobs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.syncJob.findMany({
        include: { fuente: true, ejecutadoPor: { select: { id: true, email: true, nombre: true } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.syncJob.count(),
    ]);
    return { items, meta: { total, page, limit } };
  }

  async executeManual(fuenteCodigo: string, userId?: string, force = false) {
    await this.releaseStuckJobs();

    const fuente = await this.prisma.dataSource.findUnique({ where: { codigo: fuenteCodigo } });
    if (!fuente || !fuente.activo) {
      throw new Error(`Fuente ${fuenteCodigo} no encontrada o inactiva`);
    }

    if (force) {
      const deleted = await this.prisma.syncStagingRecord.deleteMany({ where: { fuenteCodigo } });
      this.logger.log(`Force sync: eliminados ${deleted.count} registros staging de ${fuenteCodigo}`);
    }

    const job = await this.prisma.syncJob.create({
      data: {
        fuenteId: fuente.id,
        tipo: SyncJobType.MANUAL,
        status: SyncJobStatus.EN_PROCESO,
        inicioAt: new Date(),
        ejecutadoPorId: userId,
      },
    });

    try {
      const metadata = (fuente.metadata ?? {}) as { entidadDestino?: string };
      const result =
        metadata.entidadDestino === 'dispositivos_medicos'
          ? await this.syncInvimaDispositivos(fuente.datasetId!, fuente.codigo, job.id)
          : await this.syncInvimaCum(fuente.datasetId!, fuente.codigo, job.id, force);
      await this.prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: result.errors > 0 ? SyncJobStatus.PARCIAL : SyncJobStatus.COMPLETADA,
          finAt: new Date(),
          registrosLeidos: result.read,
          registrosInsertados: result.inserted,
          registrosActualizados: result.updated,
          registrosOmitidos: result.skipped,
          registrosError: result.errors,
        },
      });

      await this.audit.log({
        userId,
        accion: 'SYNC_MANUAL',
        recurso: 'sync',
        recursoId: job.id,
        metadata: result,
      });

      return { jobId: job.id, ...result };
    } catch (error) {
      await this.prisma.syncJob.update({
        where: { id: job.id },
        data: { status: SyncJobStatus.FALLIDA, finAt: new Date() },
      });
      throw error;
    }
  }

  async deleteJob(jobId: string, userId?: string) {
    const job = await this.prisma.syncJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Sincronización no encontrada');
    if (job.status === SyncJobStatus.EN_PROCESO) {
      throw new BadRequestException(
        'No se puede eliminar una sincronización en curso. Cancélela primero.',
      );
    }
    await this.prisma.syncJob.delete({ where: { id: jobId } });
    await this.audit.log({
      userId,
      accion: 'DELETE',
      recurso: 'sync',
      recursoId: jobId,
    });
    return { ok: true };
  }

  async cancelJob(jobId: string, userId?: string) {
    const job = await this.prisma.syncJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Sincronización no encontrada');
    if (job.status !== SyncJobStatus.EN_PROCESO && job.status !== SyncJobStatus.PENDIENTE) {
      throw new BadRequestException(
        'Solo se pueden cancelar sincronizaciones pendientes o en proceso',
      );
    }
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: SyncJobStatus.FALLIDA,
        finAt: new Date(),
        metadata: {
          ...(typeof job.metadata === 'object' && job.metadata ? job.metadata : {}),
          canceladoPorAdmin: true,
          canceladoAt: new Date().toISOString(),
        },
      },
    });
    await this.audit.log({
      userId,
      accion: 'CANCEL',
      recurso: 'sync',
      recursoId: jobId,
    });
    return { ok: true, status: 'FALLIDA' };
  }

  private async releaseStuckJobs() {
    const threshold = new Date(Date.now() - 60 * 60 * 1000);
    const { count } = await this.prisma.syncJob.updateMany({
      where: { status: SyncJobStatus.EN_PROCESO, inicioAt: { lt: threshold } },
      data: { status: SyncJobStatus.FALLIDA, finAt: new Date() },
    });
    if (count > 0) {
      this.logger.warn(`Marcados ${count} sync jobs colgados como FALLIDA`);
    }
  }

  private async updateJobProgress(jobId: string, progress: SyncProgress) {
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        registrosLeidos: progress.read,
        registrosInsertados: progress.inserted,
        registrosActualizados: progress.updated,
        registrosOmitidos: progress.skipped,
        registrosError: progress.errors,
      },
    });
  }

  private async syncInvimaCum(
    datasetId: string,
    fuenteCodigo: string,
    jobId: string,
    force = false,
  ) {
    const appToken = this.config.get<string>('INVIMA_APP_TOKEN');
    let offset = 0;
    const batchSize = 1000;
    let read = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(`https://www.datos.gov.co/resource/${datasetId}.json`);
      url.searchParams.set('$limit', String(batchSize));
      url.searchParams.set('$offset', String(offset));

      const headers: Record<string, string> = { Accept: 'application/json' };
      if (appToken) headers['X-App-Token'] = appToken;

      const response = await fetch(url.toString(), { headers });
      if (!response.ok) {
        throw new Error(`INVIMA API error: ${response.status} ${response.statusText}`);
      }

      const records = (await response.json()) as Record<string, unknown>[];
      if (!records.length) break;

      for (const [index, raw] of records.entries()) {
        read++;
        const record = normalizeCumRecord(raw);
        try {
          const action = await this.upsertMedicamentoRecord(record, fuenteCodigo, jobId, force);
          if (action === 'INSERT') inserted++;
          else if (action === 'UPDATE') updated++;
          else skipped++;
        } catch (err) {
          errors++;
          await this.prisma.syncError.create({
            data: {
              syncJobId: jobId,
              filaNumero: offset + index + 1,
              errorMensaje: err instanceof Error ? err.message : 'Error desconocido',
              valor: JSON.stringify(record),
            },
          });
        }
      }

      offset += records.length;
      hasMore = records.length === batchSize;
      await this.updateJobProgress(jobId, { read, inserted, updated, skipped, errors });
      this.logger.log(
        `Sync ${fuenteCodigo}: ${offset} leídos | +${inserted} ins | ~${updated} upd | ${skipped} omit`,
      );
    }

    return { read, inserted, updated, skipped, errors };
  }

  private async upsertMedicamentoRecord(
    record: SocrataRecord,
    fuenteCodigo: string,
    jobId: string,
    force = false,
  ): Promise<'INSERT' | 'UPDATE' | 'SKIP'> {
    const numeroRegistro = record.registrosanitario?.trim();
    if (!numeroRegistro) return 'SKIP';

    const hash = createHash('sha256').update(JSON.stringify(record)).digest('hex');
    const codigoCompleto =
      record.expedientecum && record.consecutivocum
        ? `${record.expedientecum}-${record.consecutivocum}`
        : null;
    const claveNatural = codigoCompleto ?? numeroRegistro;

    const existingStaging = await this.prisma.syncStagingRecord.findUnique({
      where: { fuenteCodigo_claveNatural: { fuenteCodigo, claveNatural } },
    });

    let cumNeedsBackfill = false;
    if (codigoCompleto) {
      const existingCum = await this.prisma.codigoCum.findUnique({
        where: { codigoCompleto },
        select: { descripcionProducto: true },
      });
      cumNeedsBackfill = !existingCum?.descripcionProducto?.trim();
      if (!cumNeedsBackfill) {
        const pres = await this.prisma.presentacion.findFirst({
          where: { codigoCum: codigoCompleto },
          select: { id: true },
        });
        cumNeedsBackfill = !pres;
      }
    }

    if (existingStaging?.hashContenido === hash && !force && !cumNeedsBackfill) {
      return 'SKIP';
    }

    await this.prisma.syncStagingRecord.upsert({
      where: { fuenteCodigo_claveNatural: { fuenteCodigo, claveNatural } },
      update: { payload: record as object, hashContenido: hash, procesado: false },
      create: {
        fuenteCodigo,
        claveNatural,
        payload: record as object,
        hashContenido: hash,
      },
    });

    const titularName = record.titular?.trim();
    let titularId: string | undefined;
    if (titularName) {
      let lab = await this.prisma.laboratory.findFirst({
        where: { razonSocial: { equals: titularName, mode: 'insensitive' } },
      });
      if (!lab) {
        lab = await this.prisma.laboratory.create({
          data: {
            razonSocial: titularName,
            tipo: LaboratoryType.TITULAR,
          },
        });
      }
      titularId = lab.id;
    }

    const registro = await this.prisma.invimaRegistration.upsert({
      where: { numeroRegistro },
      update: {
        estado: record.estadoregistro,
        fechaVencimiento: record.fechavencimiento ? new Date(record.fechavencimiento) : undefined,
      },
      create: {
        numeroRegistro,
        expediente: record.expedientecum,
        estado: record.estadoregistro,
        fechaExpedicion: record.fechaexpedicion ? new Date(record.fechaexpedicion) : undefined,
        fechaVencimiento: record.fechavencimiento ? new Date(record.fechavencimiento) : undefined,
        tipoProducto: ProductType.MEDICAMENTO,
      },
    });

    const nombreComercial = record.producto?.trim() ?? numeroRegistro;
    const existingMed = await this.prisma.medicamento.findUnique({
      where: { registroInvimaId: registro.id },
    });

    const medDataBase = {
      nombreComercial,
      nombreNormalizado: normalize(nombreComercial),
      concentracion: record.concentracion,
      formaFarmaceutica: record.formafarmaceutica,
      titularId,
      laboratorioId: titularId,
      estadoRegistro: mapEstado(record.estadoregistro),
      fechaVencimiento: record.fechavencimiento ? new Date(record.fechavencimiento) : undefined,
      hashContenido: hash,
      fuente: DataOrigin.INVIMA,
    };

    let action: 'INSERT' | 'UPDATE' | 'SKIP';
    if (existingMed) {
      if (existingMed.hashContenido === hash && !force && !cumNeedsBackfill) {
        action = 'SKIP';
      } else {
        await this.prisma.medicamento.update({
          where: { id: existingMed.id },
          data: { ...medDataBase, syncVersion: { increment: 1 } },
        });
        action = 'UPDATE';
      }
    } else {
      await this.prisma.medicamento.create({
        data: { ...medDataBase, registroInvimaId: registro.id, syncVersion: BigInt(1) },
      });
      action = 'INSERT';
    }

    if (record.principioactivo) {
      const pa = await this.prisma.activeIngredient.upsert({
        where: { nombreNormalizado: normalize(record.principioactivo) },
        update: {},
        create: {
          nombreNormalizado: normalize(record.principioactivo),
          nombreOficial: record.principioactivo.trim(),
        },
      });
      const med = await this.prisma.medicamento.findUniqueOrThrow({
        where: { registroInvimaId: registro.id },
      });
      await this.prisma.medicamentoPrincipioActivo.upsert({
        where: {
          medicamentoId_principioActivoId: {
            medicamentoId: med.id,
            principioActivoId: pa.id,
          },
        },
        update: { concentracion: record.concentracion },
        create: {
          medicamentoId: med.id,
          principioActivoId: pa.id,
          concentracion: record.concentracion,
          esPrincipal: true,
        },
      });
    }

    if (record.expedientecum && record.consecutivocum) {
      const cumCode = `${record.expedientecum}-${record.consecutivocum}`;
      const descComercial = record.descripcioncomercial?.trim() ?? null;
      const productoDescRaw = descComercial ?? record.producto?.trim() ?? null;
      const productoDesc = productoDescRaw ? productoDescRaw.slice(0, 500) : null;
      const med = await this.prisma.medicamento.findUniqueOrThrow({
        where: { registroInvimaId: registro.id },
      });
      await this.prisma.codigoCum.upsert({
        where: { codigoCompleto: cumCode },
        update: {
          estadoCum: record.estadocum,
          descripcionProducto: productoDesc,
        },
        create: {
          expedienteCum: record.expedientecum,
          consecutivo: record.consecutivocum,
          codigoCompleto: cumCode,
          estadoCum: record.estadocum,
          descripcionProducto: productoDesc,
          medicamentoId: med.id,
        },
      });

      const emb = extractEmbalaje(productoDesc ?? undefined);
      const cantidadCum = record.cantidadcum?.trim();
      const presDescripcion = productoDesc ?? `${nombreComercial}${emb.embalaje ? ` ${emb.embalaje}` : ''}`;
      const existingPres = await this.prisma.presentacion.findFirst({
        where: { medicamentoId: med.id, codigoCum: cumCode },
      });
      const presData = {
        descripcion: presDescripcion.slice(0, 500),
        cantidad: cantidadCum
          ? parseFloat(cantidadCum.replace(',', '.'))
          : emb.cantidad
            ? parseFloat(emb.cantidad)
            : undefined,
        unidad: record.formafarmaceutica?.slice(0, 50) ?? emb.unidad?.slice(0, 50) ?? emb.embalaje?.split(' x ')[0]?.slice(0, 50),
      };
      if (existingPres) {
        await this.prisma.presentacion.update({
          where: { id: existingPres.id },
          data: presData,
        });
      } else {
        await this.prisma.presentacion.create({
          data: { medicamentoId: med.id, codigoCum: cumCode, ...presData },
        });
      }

      if (action === 'SKIP' && (cumNeedsBackfill || force)) {
        action = 'UPDATE';
      }
    }

    await this.prisma.syncRecord.create({
      data: {
        syncJobId: jobId,
        entidadTipo: 'medicamento',
        claveNatural,
        accion: action === 'INSERT' ? SyncRecordAction.INSERT : SyncRecordAction.UPDATE,
        hashNuevo: hash,
        hashAnterior: existingMed?.hashContenido,
      },
    });

    return action;
  }

  private async syncInvimaDispositivos(datasetId: string, fuenteCodigo: string, jobId: string) {
    const appToken = this.config.get<string>('INVIMA_APP_TOKEN');
    let offset = 0;
    const batchSize = 1000;
    let read = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(`https://www.datos.gov.co/resource/${datasetId}.json`);
      url.searchParams.set('$limit', String(batchSize));
      url.searchParams.set('$offset', String(offset));

      const headers: Record<string, string> = { Accept: 'application/json' };
      if (appToken) headers['X-App-Token'] = appToken;

      const response = await fetch(url.toString(), { headers });
      if (!response.ok) {
        throw new Error(`INVIMA dispositivos API error: ${response.status}`);
      }

      const records = (await response.json()) as Record<string, unknown>[];
      if (!records.length) break;

      for (const [index, raw] of records.entries()) {
        read++;
        const record = normalizeDispositivoRecord(raw);
        try {
          const action = await this.upsertDispositivoRecord(record, fuenteCodigo, jobId);
          if (action === 'INSERT') inserted++;
          else if (action === 'UPDATE') updated++;
          else skipped++;
        } catch (err) {
          errors++;
          await this.prisma.syncError.create({
            data: {
              syncJobId: jobId,
              filaNumero: offset + index + 1,
              errorMensaje: err instanceof Error ? err.message : 'Error desconocido',
              valor: JSON.stringify(record),
            },
          });
        }
      }

      offset += records.length;
      hasMore = records.length === batchSize;
      await this.updateJobProgress(jobId, { read, inserted, updated, skipped, errors });
      this.logger.log(
        `Sync DM ${fuenteCodigo}: ${offset} leídos | +${inserted} ins | ~${updated} upd | ${skipped} omit`,
      );
    }

    return { read, inserted, updated, skipped, errors };
  }

  private async upsertDispositivoRecord(
    record: DispositivoRecord,
    fuenteCodigo: string,
    jobId: string,
  ): Promise<'INSERT' | 'UPDATE' | 'SKIP'> {
    const numeroRegistro = record.registrosanitario?.trim();
    if (!numeroRegistro) return 'SKIP';

    const hash = createHash('sha256').update(JSON.stringify(record)).digest('hex');
    const claveNatural = numeroRegistro;

    const existingStaging = await this.prisma.syncStagingRecord.findUnique({
      where: { fuenteCodigo_claveNatural: { fuenteCodigo, claveNatural } },
    });
    if (existingStaging?.hashContenido === hash) return 'SKIP';

    await this.prisma.syncStagingRecord.upsert({
      where: { fuenteCodigo_claveNatural: { fuenteCodigo, claveNatural } },
      update: { payload: record as object, hashContenido: hash, procesado: false },
      create: { fuenteCodigo, claveNatural, payload: record as object, hashContenido: hash },
    });

    const titularName = record.titular?.trim();
    let fabricanteId: string | undefined;
    if (titularName) {
      let lab = await this.prisma.laboratory.findFirst({
        where: { razonSocial: { equals: titularName, mode: 'insensitive' } },
      });
      if (!lab) {
        lab = await this.prisma.laboratory.create({
          data: { razonSocial: titularName, tipo: LaboratoryType.FABRICANTE },
        });
      }
      fabricanteId = lab.id;
    }

    const registro = await this.prisma.invimaRegistration.upsert({
      where: { numeroRegistro },
      update: {
        estado: record.estadoregistro,
        fechaVencimiento: record.fechavencimiento ? new Date(record.fechavencimiento) : undefined,
      },
      create: {
        numeroRegistro,
        estado: record.estadoregistro,
        fechaVencimiento: record.fechavencimiento ? new Date(record.fechavencimiento) : undefined,
        tipoProducto: ProductType.DISPOSITIVO,
      },
    });

    const nombre = record.producto?.trim() ?? numeroRegistro;
    const existing = await this.prisma.dispositivoMedico.findUnique({
      where: { registroInvimaId: registro.id },
    });

    const data = {
      nombre,
      categoria: record.categoria,
      fabricanteId,
      estadoRegistro: mapEstado(record.estadoregistro),
      hashContenido: hash,
      fuente: DataOrigin.INVIMA,
    };

    let action: 'INSERT' | 'UPDATE';
    if (existing) {
      if (existing.hashContenido === hash) return 'SKIP';
      await this.prisma.dispositivoMedico.update({
        where: { id: existing.id },
        data: { ...data, syncVersion: { increment: 1 } },
      });
      action = 'UPDATE';
    } else {
      await this.prisma.dispositivoMedico.create({
        data: { ...data, registroInvimaId: registro.id, syncVersion: BigInt(1) },
      });
      action = 'INSERT';
    }

    await this.prisma.syncRecord.create({
      data: {
        syncJobId: jobId,
        entidadTipo: 'dispositivo_medico',
        claveNatural,
        accion: action === 'INSERT' ? SyncRecordAction.INSERT : SyncRecordAction.UPDATE,
        hashNuevo: hash,
        hashAnterior: existing?.hashContenido,
      },
    });

    return action;
  }
}
