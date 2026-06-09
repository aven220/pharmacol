import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FraudRiskLevel, EntityType, SearchType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OcrService } from '../ocr/ocr.service';
import { parseOcrText, normalizeRegistro } from '../../common/utils/ocr-text.util';
import { IaIdentifyDto } from '../ocr/dto/ocr.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly ocrService: OcrService,
  ) {}

  async identify(dto: IaIdentifyDto, user: JwtPayload) {
    const textoCrudo = dto.textoCrudo ? dto.textoCrudo : undefined;
    const parsed = textoCrudo ? parseOcrText(textoCrudo) : {};
    const ocr = { ...parsed, ...dto.ocrData } as Record<string, unknown>;
    const registro = normalizeRegistro(
      String(ocr.registroInvima ?? ocr.registro ?? ''),
    );
    const cum = String(ocr.cum ?? '').trim();
    const nombre = String(ocr.nombre ?? '').trim();

    let coincidencias = await this.ocrService.findMatches(
      ocr as Parameters<OcrService['findMatches']>[0],
      textoCrudo,
    );

    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey && coincidencias.length === 0 && nombre) {
      const enriched = await this.enrichWithOpenAI(nombre, openaiKey);
      coincidencias = enriched;
    }

    const confianzaGlobal = coincidencias[0]?.score ?? 0.2;
    const inconsistencias: string[] = [];

    if (!coincidencias.length) inconsistencias.push('No se encontró coincidencia en base INVIMA');
    if (registro && coincidencias[0]?.numeroRegistro) {
      const regNorm = normalizeRegistro(coincidencias[0].numeroRegistro);
      if (regNorm.toLowerCase() !== registro.toLowerCase()) {
        inconsistencias.push('Registro OCR difiere del registro oficial');
      }
    }

    await this.audit.log({
      userId: user.sub,
      accion: 'IA_IDENTIFY',
      recurso: 'ia',
      metadata: { matches: coincidencias.length, confianzaGlobal },
    });

    await this.prisma.queryHistory.create({
      data: {
        userId: user.sub,
        tipoBusqueda: SearchType.IA,
        query: (nombre || registro || cum || 'ocr').slice(0, 500),
        resultadoId: coincidencias[0]?.medicamentoId,
        entidadTipo: coincidencias[0]?.medicamentoId ? EntityType.MEDICAMENTO : undefined,
      },
    }).catch((err) => {
      this.logger.warn(`No se pudo registrar historial IA: ${err}`);
    });

    return {
      coincidencias: coincidencias.map((c) => ({
        medicamentoId: c.medicamentoId,
        presentacionId: c.presentacionId,
        nombreComercial: c.nombreComercial,
        presentacionComercial: c.presentacionComercial,
        embalaje: c.embalaje,
        concentracion: c.concentracion,
        formaFarmaceutica: c.formaFarmaceutica,
        cantidad: c.cantidad,
        numeroRegistro: c.numeroRegistro,
        cum: c.cum,
        laboratorio: c.laboratorio,
        score: c.score,
        matchLevel: c.matchLevel,
        matchType: c.matchType,
      })),
      confianzaGlobal,
      inconsistencias,
      presentaciones: coincidencias,
    };
  }

  private async enrichWithOpenAI(nombre: string, apiKey: string) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Identifica el nombre comercial de medicamento colombiano. Responde solo JSON: {"nombre":"..."}',
            },
            { role: 'user', content: nombre },
          ],
          temperature: 0.2,
        }),
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(content) as { nombre?: string };
      if (parsed.nombre) {
        return this.ocrService.findMatches({ nombre: parsed.nombre });
      }
    } catch (err) {
      this.logger.warn(`OpenAI fallback failed: ${err}`);
    }
    return [];
  }
}

@Injectable()
export class AntifalsificacionService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluar(ocrData: Record<string, unknown>, medicamentoId?: string) {
    const registro = String(ocrData.registroInvima ?? ocrData.registro ?? '').trim();
    const labOcr = String(ocrData.laboratorio ?? ocrData.titular ?? '').trim().toLowerCase();
    let score = 0;
    const reglas: string[] = [];

    if (!medicamentoId && !registro) {
      return this.buildAlert(100, ['REGISTRO_INEXISTENTE'], 'CRITICO');
    }

    const med = medicamentoId
      ? await this.prisma.medicamento.findUnique({
          where: { id: medicamentoId },
          include: { registroInvima: true, titular: true, laboratorio: true },
        })
      : await this.prisma.medicamento.findFirst({
          where: { registroInvima: { numeroRegistro: { equals: registro, mode: 'insensitive' } } },
          include: { registroInvima: true, titular: true, laboratorio: true },
        });

    if (!med) {
      return this.buildAlert(100, ['REGISTRO_INEXISTENTE'], 'CRITICO');
    }

    if (med.estadoRegistro !== 'VIGENTE') {
      score += 80;
      reglas.push('REGISTRO_NO_VIGENTE');
    }

    const titular = med.titular?.razonSocial?.toLowerCase() ?? '';
    if (labOcr && titular && !titular.includes(labOcr) && !labOcr.includes(titular)) {
      score += 60;
      reglas.push('LABORATORIO_DIFERENTE');
    }

    const nivel = score >= 80 ? 'CRITICO' : score >= 40 ? 'ALTO' : score >= 20 ? 'MEDIO' : 'BAJO';
    return this.buildAlert(score, reglas, nivel as FraudRiskLevel, med.nombreComercial);
  }

  private buildAlert(score: number, reglas: string[], nivel: FraudRiskLevel | string, producto?: string) {
    const mensajes: Record<string, string> = {
      REGISTRO_INEXISTENTE: 'El registro no existe en la base INVIMA',
      REGISTRO_NO_VIGENTE: 'El registro no está vigente',
      LABORATORIO_DIFERENTE: 'El laboratorio no coincide con el titular oficial',
    };
    const mensajeUsuario = reglas.map((r) => mensajes[r] ?? r).join('. ') ||
      (producto ? `Producto verificado: ${producto}` : 'Sin inconsistencias detectadas');

    return {
      score,
      nivelRiesgo: nivel,
      reglasDisparadas: reglas,
      mensajeUsuario,
      requiereReporte: score >= 80,
    };
  }
}
