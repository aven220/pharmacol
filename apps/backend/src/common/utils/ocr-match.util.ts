import { normalizeText, similarityScore } from './text.util';
import type { OcrStructuredData } from './ocr-text.util';

export interface PresentationCandidate {
  medicamentoId: string;
  presentacionId: string;
  nombreComercial: string;
  presentacionComercial?: string;
  concentracion?: string;
  formaFarmaceutica?: string;
  cantidad?: string;
  unidad?: string;
  presentacionTexto?: string;
  cum?: string;
  consecutivo?: string;
  numeroRegistro?: string;
  laboratorio?: string;
  principioActivo?: string;
}

export interface RankedMatch extends PresentationCandidate {
  score: number;
  matchLevel: 'exacta' | 'muy_alta' | 'alta' | 'media';
  matchType: string;
}

const MIN_SCORE_DEFAULT = 0.9;
const MIN_SCORE_FALLBACK = 0.75;

export function getMatchLevel(score: number): RankedMatch['matchLevel'] {
  if (score >= 0.995) return 'exacta';
  if (score >= 0.95) return 'muy_alta';
  if (score >= 0.9) return 'alta';
  return 'media';
}

export function getMatchLevelLabel(level: RankedMatch['matchLevel']): string {
  const labels: Record<RankedMatch['matchLevel'], string> = {
    exacta: 'Coincidencia exacta',
    muy_alta: 'Coincidencia muy alta',
    alta: 'Coincidencia alta',
    media: 'Coincidencia media',
  };
  return labels[level];
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalizeText(a).split(/\s+/).filter((t) => t.length > 2));
  const tb = new Set(normalizeText(b).split(/\s+/).filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.max(ta.size, tb.size);
}

function scoreField(ocrValue: string | undefined, dbValue: string | undefined, weight: number): number {
  if (!ocrValue || !dbValue) return 0;
  const sim = similarityScore(ocrValue, dbValue);
  const tok = tokenOverlap(ocrValue, dbValue);
  return Math.max(sim, tok) * weight;
}

export function scorePresentation(
  ocr: OcrStructuredData & { presentacion?: string; formaFarmaceutica?: string; cantidad?: string; unidad?: string },
  candidate: PresentationCandidate,
  rawText?: string,
): { score: number; matchType: string } {
  const raw = normalizeText(rawText ?? '');

  if (ocr.registroInvima && candidate.numeroRegistro) {
    const regOcr = normalizeText(ocr.registroInvima.replace(/^invima\s*/i, ''));
    const regDb = normalizeText(candidate.numeroRegistro.replace(/^invima\s*/i, ''));
    if (regOcr === regDb || regDb.includes(regOcr) || regOcr.includes(regDb)) {
      return { score: 1, matchType: 'registro' };
    }
  }

  if (ocr.cum && candidate.cum) {
    const cumOcr = normalizeText(ocr.cum);
    const cumDb = normalizeText(candidate.cum);
    if (cumOcr === cumDb || cumDb.includes(cumOcr)) {
      return { score: 0.98, matchType: 'cum' };
    }
  }

  let score = 0;
  let weightSum = 0;

  const add = (ocrVal: string | undefined, dbVal: string | undefined, w: number) => {
    if (!dbVal) return;
    weightSum += w;
    score += scoreField(ocrVal ?? '', dbVal, w);
  };

  add(ocr.nombre, candidate.nombreComercial, 0.3);
  add(ocr.nombre, candidate.presentacionComercial, 0.15);
  add(ocr.concentracion, candidate.concentracion, 0.2);
  add(ocr.formaFarmaceutica, candidate.formaFarmaceutica, 0.15);
  add(ocr.presentacion, candidate.presentacionTexto, 0.15);
  add(ocr.cantidad, candidate.cantidad, 0.1);
  add(ocr.laboratorio, candidate.laboratorio, 0.1);
  add(ocr.principioActivo, candidate.principioActivo, 0.15);

  if (raw && candidate.nombreComercial) {
    const fullDb = [
      candidate.nombreComercial,
      candidate.concentracion,
      candidate.formaFarmaceutica,
      candidate.presentacionTexto,
      candidate.cantidad,
      candidate.unidad,
    ]
      .filter(Boolean)
      .join(' ');
    const fullSim = similarityScore(raw, fullDb);
    if (fullSim > 0.5) {
      weightSum += 0.2;
      score += fullSim * 0.2;
    }
  }

  if (weightSum === 0) return { score: 0, matchType: 'nombre' };

  const normalized = Math.min(0.99, score / weightSum);
  return { score: normalized, matchType: 'compuesto' };
}

export function filterAndRankMatches(matches: RankedMatch[]): RankedMatch[] {
  const sorted = [...matches].sort((a, b) => b.score - a.score);
  const above90 = sorted.filter((m) => m.score >= MIN_SCORE_DEFAULT);
  if (above90.length) return above90;
  const fallback = sorted.filter((m) => m.score >= MIN_SCORE_FALLBACK);
  return fallback.length ? fallback : sorted.slice(0, 3);
}
