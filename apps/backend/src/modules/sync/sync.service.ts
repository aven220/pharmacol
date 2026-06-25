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
import { MailService, type AlertaDigestItem } from '../notifications/mail.service';
import {
  INVIMA_PORTAL_CATEGORIES,
  buildInvimaPortalPageUrl,
  parseInvimaPortalHtml,
  type InvimaPortalAlerta,
} from './invima-portal.parser';

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

interface AlertaSanitariaRecord {
  numeroColumna?: string;
  fecha?: string;
  principioActivo?: string;
  descripcion?: string;
  fuenteAlerta?: string;
  comunicadoInvima?: string;
  conceptoSempb?: string;
  acta?: string;
}

function normalizeAlertaRecord(raw: Record<string, unknown>): AlertaSanitariaRecord {
  return {
    numeroColumna: pickField(raw, 'numero_columna', 'numero'),
    fecha: pickField(raw, 'fecha'),
    principioActivo: pickField(raw, 'principio_activo', 'principioactivo'),
    descripcion: pickField(raw, 'descripci_n', 'descripcion', 'descripci_n'),
    fuenteAlerta: pickField(raw, 'fuente_de_la_alerta', 'fuente_alerta'),
    comunicadoInvima: pickField(raw, 'comunicado_invima'),
    conceptoSempb: pickField(raw, 'concepto_sempb_de_la_comision', 'concepto_sempb'),
    acta: pickField(raw, 'acta'),
  };
}

function parseComunicadoInvima(raw?: string): { tipo?: string; url?: string } {
  if (!raw) return {};
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const url = lines.find((l) => /^https?:\/\//i.test(l));
  return { tipo: lines[0], url };
}

function extractNumeroAlerta(comunicado?: string, numeroColumna?: string, fecha?: string): string {
  if (comunicado) {
    const decoded = decodeURIComponent(comunicado);
    const match = decoded.match(/Alerta\s*No[_#.\s]*(\d+-\d{4})/i);
    if (match) return match[1];
  }
  const year = fecha?.slice(0, 4) ?? new Date().getFullYear().toString();
  if (numeroColumna) return `${numeroColumna}-${year}`;
  return `sin-numero-${year}-${createHash('sha256').update(comunicado ?? fecha ?? '').digest('hex').slice(0, 8)}`;
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
    private readonly mail: MailService,
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
      const entidad = metadata.entidadDestino;
      const result =
        entidad === 'dispositivos_medicos'
          ? await this.syncInvimaDispositivos(fuente.datasetId!, fuente.codigo, job.id)
          : entidad === 'alertas_sanitarias'
            ? await this.syncInvimaAlertasSanitarias(fuente.datasetId!, fuente.codigo, job.id, force)
            : entidad === 'alertas_sanitarias_portal'
              ? await this.syncInvimaAlertasPortal(fuente.codigo, job.id, force)
              : await this.syncInvimaCum(fuente.datasetId!, fuente.codigo, job.id, force);

      if (entidad === 'alertas_sanitarias' || entidad === 'alertas_sanitarias_portal') {
        if (this.syncHasChanges(result)) {
          await this.sendAlertasDigest(job.id, result);
        }
      }

      if (this.syncHasChanges(result)) {
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

        return { jobId: job.id, persisted: true, ...result };
      }

      await this.prisma.syncJob.delete({ where: { id: job.id } });
      this.logger.log(
        `Sync ${fuenteCodigo}: sin cambios (${result.read} leídos, ${result.skipped} omitidos) — no se guarda en historial`,
      );

      return { jobId: null, persisted: false, ...result };
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

  private async syncInvimaAlertasSanitarias(
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
      url.searchParams.set('$order', 'fecha DESC');

      const headers: Record<string, string> = { Accept: 'application/json' };
      if (appToken) headers['X-App-Token'] = appToken;

      const response = await fetch(url.toString(), { headers });
      if (!response.ok) {
        throw new Error(`INVIMA alertas API error: ${response.status} ${response.statusText}`);
      }

      const records = (await response.json()) as Record<string, unknown>[];
      if (!records.length) break;

      for (const [index, raw] of records.entries()) {
        read++;
        const record = normalizeAlertaRecord(raw);
        try {
          const action = await this.upsertAlertaSanitariaRecord(record, fuenteCodigo, jobId, force);
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
        `Sync alertas ${fuenteCodigo}: ${offset} leídos | +${inserted} ins | ~${updated} upd | ${skipped} omit`,
      );
    }

    return { read, inserted, updated, skipped, errors };
  }

  private async upsertAlertaSanitariaRecord(
    record: AlertaSanitariaRecord,
    fuenteCodigo: string,
    jobId: string,
    force = false,
  ): Promise<'INSERT' | 'UPDATE' | 'SKIP'> {
    const titulo = record.principioActivo?.trim();
    const descripcion = record.descripcion?.trim();
    if (!titulo || !descripcion || !record.fecha) return 'SKIP';

    const numeroAlerta = extractNumeroAlerta(
      record.comunicadoInvima,
      record.numeroColumna,
      record.fecha,
    );
    const hash = createHash('sha256').update(JSON.stringify(record)).digest('hex');
    const claveNatural = numeroAlerta;
    const { tipo, url } = parseComunicadoInvima(record.comunicadoInvima);
    const fechaAlerta = new Date(record.fecha);

    const existingStaging = await this.prisma.syncStagingRecord.findUnique({
      where: { fuenteCodigo_claveNatural: { fuenteCodigo, claveNatural } },
    });
    if (existingStaging?.hashContenido === hash && !force) return 'SKIP';

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

    const existing = await this.prisma.alertaSanitaria.findUnique({
      where: { numeroAlerta },
    });

    const data = {
      numeroAlerta,
      fechaAlerta,
      titulo: titulo.slice(0, 500),
      tituloNorm: normalize(titulo).slice(0, 500),
      descripcion,
      fuenteAlerta: record.fuenteAlerta?.slice(0, 100),
      tipoDocumento: tipo?.slice(0, 100),
      documentoUrl: url,
      conceptoSempb: record.conceptoSempb,
      acta: record.acta?.slice(0, 100),
      hashContenido: hash,
      fuente: DataOrigin.INVIMA,
      canalOrigen: existing?.canalOrigen === 'PORTAL' ? 'PORTAL' : 'DATOS_GOV',
    };

    let action: 'INSERT' | 'UPDATE' | 'SKIP';
    if (existing) {
      if (existing.hashContenido === hash && !force) {
        action = 'SKIP';
      } else {
        await this.prisma.alertaSanitaria.update({
          where: { id: existing.id },
          data: { ...data, syncVersion: { increment: 1 } },
        });
        action = 'UPDATE';
      }
    } else {
      await this.prisma.alertaSanitaria.create({
        data: { ...data, syncVersion: BigInt(1) },
      });
      action = 'INSERT';
    }

    if (action !== 'SKIP') {
      await this.prisma.syncRecord.create({
        data: {
          syncJobId: jobId,
          entidadTipo: 'alerta_sanitaria',
          claveNatural,
          accion: action === 'INSERT' ? SyncRecordAction.INSERT : SyncRecordAction.UPDATE,
          hashNuevo: hash,
          hashAnterior: existing?.hashContenido,
        },
      });
    }

    return action;
  }

  private async syncInvimaAlertasPortal(fuenteCodigo: string, jobId: string, force = false) {
    const maxPages = Number(this.config.get<string>('INVIMA_PORTAL_MAX_PAGES') ?? 25);
    const lookbackDays = Number(this.config.get<string>('INVIMA_PORTAL_LOOKBACK_DAYS') ?? 120);
    const delayMs = Number(this.config.get<string>('INVIMA_PORTAL_DELAY_MS') ?? 350);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    let read = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const category of INVIMA_PORTAL_CATEGORIES) {
      let stopCategory = false;
      for (let page = 0; page < maxPages && !stopCategory; page++) {
        const url = buildInvimaPortalPageUrl(category.slug, page);
        let html: string;
        try {
          const response = await fetch(url, {
            headers: { 'User-Agent': 'PharmaCol/1.0 (+https://pharmacol.co)' },
          });
          if (!response.ok) {
            throw new Error(`Portal INVIMA HTTP ${response.status} en ${category.slug} p${page}`);
          }
          html = await response.text();
        } catch (err) {
          errors++;
          await this.prisma.syncError.create({
            data: {
              syncJobId: jobId,
              filaNumero: read + 1,
              errorMensaje: err instanceof Error ? err.message : 'Error portal INVIMA',
              valor: url,
            },
          });
          break;
        }

        const rows = parseInvimaPortalHtml(html, category.codigo);
        if (!rows.length) break;

        let oldestOnPage = new Date();
        for (const [index, row] of rows.entries()) {
          read++;
          const fecha = new Date(row.fecha);
          if (fecha < oldestOnPage) oldestOnPage = fecha;
          try {
            const action = await this.upsertAlertaPortalRecord(row, fuenteCodigo, jobId, force);
            if (action === 'INSERT') inserted++;
            else if (action === 'UPDATE') updated++;
            else skipped++;
          } catch (err) {
            errors++;
            await this.prisma.syncError.create({
              data: {
                syncJobId: jobId,
                filaNumero: read,
                errorMensaje: err instanceof Error ? err.message : 'Error desconocido',
                valor: JSON.stringify(row),
              },
            });
          }
          if (index === rows.length - 1 && (index + 1) % 10 === 0) {
            await this.updateJobProgress(jobId, { read, inserted, updated, skipped, errors });
          }
        }

        if (oldestOnPage < cutoff) stopCategory = true;
        this.logger.log(
          `Portal ${category.codigo} p${page}: ${rows.length} alertas | acum ${read} leídas`,
        );
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    await this.updateJobProgress(jobId, { read, inserted, updated, skipped, errors });
    return { read, inserted, updated, skipped, errors };
  }

  private async upsertAlertaPortalRecord(
    record: InvimaPortalAlerta,
    fuenteCodigo: string,
    jobId: string,
    force = false,
  ): Promise<'INSERT' | 'UPDATE' | 'SKIP'> {
    const titulo = record.titulo.trim();
    const numeroAlerta = record.numeroAlerta;
    const hash = createHash('sha256').update(JSON.stringify(record)).digest('hex');
    const claveNatural = numeroAlerta;
    const fechaAlerta = new Date(record.fecha);

    const existingStaging = await this.prisma.syncStagingRecord.findUnique({
      where: { fuenteCodigo_claveNatural: { fuenteCodigo, claveNatural } },
    });
    if (existingStaging?.hashContenido === hash && !force) return 'SKIP';

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

    const existing = await this.prisma.alertaSanitaria.findUnique({
      where: { numeroAlerta },
    });

    const descripcion =
      existing?.descripcion && existing.descripcion.length > titulo.length
        ? existing.descripcion
        : titulo;

    const data = {
      numeroAlerta,
      fechaAlerta,
      titulo: titulo.slice(0, 500),
      tituloNorm: normalize(titulo).slice(0, 500),
      descripcion,
      tipoDocumento: record.tipoDocumento.slice(0, 100),
      documentoUrl: record.documentoUrl,
      categoriaProducto: record.categoriaProducto,
      canalOrigen: 'PORTAL',
      hashContenido: hash,
      fuente: DataOrigin.INVIMA,
    };

    let action: 'INSERT' | 'UPDATE' | 'SKIP';
    if (existing) {
      if (existing.hashContenido === hash && !force) {
        action = 'SKIP';
      } else {
        await this.prisma.alertaSanitaria.update({
          where: { id: existing.id },
          data: { ...data, syncVersion: { increment: 1 } },
        });
        action = 'UPDATE';
      }
    } else {
      await this.prisma.alertaSanitaria.create({
        data: { ...data, syncVersion: BigInt(1) },
      });
      action = 'INSERT';
    }

    if (action !== 'SKIP') {
      await this.prisma.syncRecord.create({
        data: {
          syncJobId: jobId,
          entidadTipo: 'alerta_sanitaria',
          claveNatural,
          accion: action === 'INSERT' ? SyncRecordAction.INSERT : SyncRecordAction.UPDATE,
          hashNuevo: hash,
          hashAnterior: existing?.hashContenido,
        },
      });
    }

    return action;
  }

  private syncHasChanges(result: SyncProgress): boolean {
    return result.inserted > 0 || result.updated > 0 || result.errors > 0;
  }

  private async sendAlertasDigest(
    jobId: string,
    result: { read: number; inserted: number; updated: number; skipped: number; errors: number },
  ) {
    const records = await this.prisma.syncRecord.findMany({
      where: {
        syncJobId: jobId,
        entidadTipo: 'alerta_sanitaria',
        accion: { in: [SyncRecordAction.INSERT, SyncRecordAction.UPDATE] },
      },
    });

    const items: AlertaDigestItem[] = [];
    for (const rec of records) {
      const alerta = await this.prisma.alertaSanitaria.findFirst({
        where: { numeroAlerta: rec.claveNatural },
      });
      if (!alerta) continue;
      items.push({
        numeroAlerta: alerta.numeroAlerta,
        titulo: alerta.titulo,
        fechaAlerta: alerta.fechaAlerta,
        accion: rec.accion === SyncRecordAction.INSERT ? 'INSERT' : 'UPDATE',
        documentoUrl: alerta.documentoUrl,
      });
    }

    items.sort((a, b) => b.fechaAlerta.getTime() - a.fechaAlerta.getTime());

    const summary =
      `Sync completada: ${result.read} leídas, ${result.inserted} nuevas, ` +
      `${result.updated} actualizadas, ${result.skipped} omitidas, ${result.errors} errores.`;

    await this.mail.sendAlertasDigest(items, summary);
  }
}
