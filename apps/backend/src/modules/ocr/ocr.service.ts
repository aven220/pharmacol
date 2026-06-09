import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  filterAndRankMatches,
  getMatchLevel,
  type PresentationCandidate,
  type RankedMatch,
  scorePresentation,
} from '../../common/utils/ocr-match.util';
import {
  cleanOcrText,
  normalizeCum,
  normalizeRegistro,
  parseOcrText,
  type OcrStructuredData,
} from '../../common/utils/ocr-text.util';
import { normalizeText, similarityScore } from '../../common/utils/text.util';
import { extractEmbalaje } from '../../common/utils/presentation.util';
import { OcrAnalyzeDto, OcrExtractImageDto } from './dto/ocr.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

export interface OcrMatch {
  medicamentoId: string;
  presentacionId?: string;
  nombreComercial: string;
  presentacionComercial?: string;
  concentracion?: string;
  formaFarmaceutica?: string;
  cantidad?: string;
  cum?: string;
  numeroRegistro?: string;
  laboratorio?: string;
  score: number;
  matchLevel: string;
  matchType: string;
  embalaje?: string;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async analyze(dto: OcrAnalyzeDto, user: JwtPayload) {
    const textoCrudo = dto.textoCrudo ? cleanOcrText(dto.textoCrudo) : undefined;
    const structured = this.mergeStructured(dto.datosEstructurados, textoCrudo);
    const coincidencias = await this.findMatches(structured, textoCrudo);

    await this.audit.log({
      userId: user.sub,
      accion: 'OCR_ANALYZE',
      recurso: 'ocr',
      metadata: { matches: coincidencias.length },
    });

    return this.buildResponse(structured, textoCrudo, coincidencias);
  }

  async extractFromImage(dto: OcrExtractImageDto, user: JwtPayload) {
    const { textoCrudo, ocrWarning } = await this.runOcrOnImage(dto.imageBase64);
    const structured = parseOcrText(textoCrudo);
    const coincidencias = textoCrudo.trim()
      ? await this.findMatches(structured, textoCrudo)
      : [];

    await this.audit.log({
      userId: user.sub,
      accion: 'OCR_EXTRACT_IMAGE',
      recurso: 'ocr',
      metadata: { chars: textoCrudo.length, matches: coincidencias.length },
    });

    return {
      ...this.buildResponse(structured, textoCrudo, coincidencias),
      ocrWarning,
    };
  }

  private buildResponse(
    structured: OcrStructuredData,
    textoCrudo: string | undefined,
    coincidencias: OcrMatch[],
  ) {
    const confianzaPromedio =
      coincidencias.length > 0
        ? coincidencias.reduce((s, c) => s + c.score, 0) / coincidencias.length
        : 0.15;

    return {
      datosEstructurados: structured,
      textoCrudo,
      coincidenciasPreliminares: coincidencias,
      presentaciones: coincidencias,
      confianzaPromedio: Math.round(confianzaPromedio * 100) / 100,
    };
  }

  private mergeStructured(
    datos: Record<string, unknown>,
    textoCrudo?: string,
  ): OcrStructuredData {
    const parsed = textoCrudo ? parseOcrText(textoCrudo) : {};
    return {
      ...parsed,
      ...Object.fromEntries(
        Object.entries(datos).filter(([, v]) => v != null && v !== ''),
      ),
    } as OcrStructuredData;
  }

  private async runOcrOnImage(
    imageBase64: string,
  ): Promise<{ textoCrudo: string; ocrWarning?: string }> {
    const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    if (!base64 || base64.length < 100) {
      return { textoCrudo: '', ocrWarning: 'Imagen inválida o demasiado pequeña' };
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      return { textoCrudo: '', ocrWarning: 'Formato de imagen no válido' };
    }

    buffer = await this.preprocessImage(buffer);

    try {
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(buffer, 'spa+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            this.logger.debug(`OCR ${Math.round((m.progress ?? 0) * 100)}%`);
          }
        },
      });

      const textoCrudo = cleanOcrText(data.text ?? '');
      if (!textoCrudo.trim()) {
        return {
          textoCrudo: '',
          ocrWarning: 'No se detectó texto legible. Intente mejor iluminación o acercar la cámara.',
        };
      }
      return { textoCrudo };
    } catch (err) {
      this.logger.error(`OCR Tesseract falló: ${err}`);
      return {
        textoCrudo: '',
        ocrWarning:
          'El motor OCR no pudo procesar la imagen. Verifique conexión al servidor e intente de nuevo.',
      };
    }
  }

  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    try {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(buffer).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;

      if (w < 10 || h < 10) {
        throw new Error(`Imagen demasiado pequeña (${w}x${h})`);
      }

      let pipeline = sharp(buffer).rotate();

      // Imágenes pequeñas: ampliar para que Tesseract pueda leer
      const minSide = Math.min(w, h);
      if (minSide < 400) {
        const scale = Math.ceil(400 / minSide);
        pipeline = pipeline.resize({
          width: w * scale,
          height: h * scale,
          fit: 'fill',
          kernel: sharp.kernel.lanczos3,
        });
      } else {
        pipeline = pipeline.resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      const out = await pipeline.grayscale().normalize().sharpen().jpeg({ quality: 88 }).toBuffer();

      const outMeta = await sharp(out).metadata();
      if ((outMeta.width ?? 0) < 3 || (outMeta.height ?? 0) < 3) {
        throw new Error('Preprocesamiento produjo imagen inválida');
      }
      return out;
    } catch (err) {
      this.logger.warn(`Preprocesamiento imagen: ${err}`);
      return buffer;
    }
  }

  async findMatches(
    input: OcrStructuredData,
    rawText?: string,
  ): Promise<OcrMatch[]> {
    const ranked = await this.findPresentationMatches(input, rawText);
    return ranked.map((m) => ({
      medicamentoId: m.medicamentoId,
      presentacionId: m.presentacionId,
      nombreComercial: m.nombreComercial,
      presentacionComercial: m.presentacionComercial,
      concentracion: m.concentracion,
      formaFarmaceutica: m.formaFarmaceutica,
      cantidad: m.cantidad,
      cum: m.cum,
      numeroRegistro: m.numeroRegistro,
      laboratorio: m.laboratorio,
      score: m.score,
      matchLevel: m.matchLevel,
      matchType: m.matchType,
      embalaje: extractEmbalaje(m.presentacionComercial ?? m.presentacionTexto).embalaje,
    }));
  }

  async findPresentationMatches(
    input: OcrStructuredData,
    rawText?: string,
  ): Promise<RankedMatch[]> {
    const registro = normalizeRegistro(String(input.registroInvima ?? ''));
    const cum = normalizeCum(String(input.cum ?? ''));
    const nombre = String(input.nombre ?? '').trim();
    const searchTerms: string[] = [];

    if (nombre) searchTerms.push(normalizeText(nombre.split(/\d/)[0].trim()));
    if (input.principioActivo) searchTerms.push(normalizeText(input.principioActivo));
    if (rawText) {
      const words = normalizeText(rawText).split(/\s+/).slice(0, 6).join(' ');
      if (words.length > 3) searchTerms.push(words);
    }

    const medicamentoIds = new Set<string>();

    if (registro) {
      const med = await this.prisma.medicamento.findFirst({
        where: {
          registroInvima: {
            numeroRegistro: { contains: registro.replace(/^INVIMA\s*/i, ''), mode: 'insensitive' },
          },
        },
        select: { id: true },
      });
      if (med) medicamentoIds.add(med.id);
    }

    if (cum) {
      const cumRow = await this.prisma.codigoCum.findFirst({
        where: {
          OR: [
            { codigoCompleto: { equals: cum, mode: 'insensitive' } },
            { codigoCompleto: { contains: cum, mode: 'insensitive' } },
          ],
        },
        select: { medicamentoId: true },
      });
      if (cumRow) medicamentoIds.add(cumRow.medicamentoId);
    }

    for (const term of searchTerms.filter(Boolean)) {
      if (term.length < 3) continue;
      const meds = await this.prisma.medicamento.findMany({
        where: {
          estadoRegistro: 'VIGENTE',
          OR: [
            { nombreNormalizado: { contains: term, mode: 'insensitive' } },
            { nombreComercial: { contains: term, mode: 'insensitive' } },
            {
              principiosActivos: {
                some: {
                  principioActivo: {
                    OR: [
                      { nombreNormalizado: { contains: term, mode: 'insensitive' } },
                      { nombreOficial: { contains: term, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          ],
        },
        select: { id: true, nombreComercial: true },
        take: 15,
      });

      for (const m of meds) {
        if (nombre && similarityScore(nombre, m.nombreComercial) >= 0.55) {
          medicamentoIds.add(m.id);
        } else if (!nombre) {
          medicamentoIds.add(m.id);
        }
      }
    }

    if (!medicamentoIds.size && nombre) {
      const fuzzy = await this.prisma.medicamento.findMany({
        where: {
          estadoRegistro: 'VIGENTE',
          nombreNormalizado: { contains: normalizeText(nombre), mode: 'insensitive' },
        },
        select: { id: true },
        take: 10,
      });
      fuzzy.forEach((m) => medicamentoIds.add(m.id));
    }

    if (!medicamentoIds.size) return [];

    const medicamentos = await this.prisma.medicamento.findMany({
      where: { id: { in: [...medicamentoIds] } },
      include: {
        registroInvima: true,
        laboratorio: true,
        codigosCum: true,
        presentaciones: true,
        principiosActivos: { include: { principioActivo: true } },
      },
    });

    const candidates: PresentationCandidate[] = [];

    for (const med of medicamentos) {
      const principio = med.principiosActivos[0]?.principioActivo?.nombreOficial;
      const codigos = med.codigosCum.length ? med.codigosCum : [null];

      for (const cumRow of codigos) {
        const matchingPres = cumRow
          ? med.presentaciones.find((p) => p.codigoCum === cumRow.codigoCompleto)
          : med.presentaciones[0];

        const descripcion =
          cumRow?.descripcionProducto ??
          matchingPres?.descripcion ??
          med.nombreComercial;
        const emb = extractEmbalaje(descripcion);

        const presText = [
          matchingPres?.descripcion ?? cumRow?.descripcionProducto,
          emb.embalaje,
          input.presentacion,
          cumRow ? `consecutivo ${cumRow.consecutivo}` : null,
        ]
          .filter(Boolean)
          .join(' ');

        candidates.push({
          medicamentoId: med.id,
          presentacionId: cumRow?.id ?? matchingPres?.id ?? med.id,
          nombreComercial: med.nombreComercial,
          presentacionComercial: emb.embalaje ?? matchingPres?.descripcion ?? descripcion,
          concentracion: med.concentracion ?? undefined,
          formaFarmaceutica: med.formaFarmaceutica ?? undefined,
          cantidad: matchingPres?.cantidad?.toString() ?? emb.cantidad ?? input.cantidad,
          unidad: matchingPres?.unidad ?? emb.unidad ?? input.unidad,
          presentacionTexto: presText || input.presentacion,
          cum: cumRow?.codigoCompleto,
          consecutivo: cumRow?.consecutivo,
          numeroRegistro: med.registroInvima?.numeroRegistro,
          laboratorio: med.laboratorio?.razonSocial,
          principioActivo: principio,
        });
      }

      for (const pres of med.presentaciones) {
        if (candidates.some((c) => c.presentacionId === pres.id)) continue;
        candidates.push({
          medicamentoId: med.id,
          presentacionId: pres.id,
          nombreComercial: med.nombreComercial,
          presentacionComercial: pres.descripcion,
          concentracion: med.concentracion ?? undefined,
          formaFarmaceutica: med.formaFarmaceutica ?? undefined,
          cantidad: pres.cantidad?.toString(),
          unidad: pres.unidad ?? undefined,
          presentacionTexto: pres.descripcion,
          cum: pres.codigoCum ?? undefined,
          numeroRegistro: med.registroInvima?.numeroRegistro,
          laboratorio: med.laboratorio?.razonSocial,
          principioActivo: principio,
        });
      }
    }

    const ranked: RankedMatch[] = candidates.map((c) => {
      const { score, matchType } = scorePresentation(input, c, rawText);
      return {
        ...c,
        score,
        matchType,
        matchLevel: getMatchLevel(score),
      };
    });

    return filterAndRankMatches(ranked);
  }
}
