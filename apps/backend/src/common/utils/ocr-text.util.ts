import { normalizeText, similarityScore } from './text.util';

export interface OcrStructuredData {
  nombre?: string;
  registroInvima?: string;
  cum?: string;
  lote?: string;
  vencimiento?: string;
  concentracion?: string;
  laboratorio?: string;
  formaFarmaceutica?: string;
  presentacion?: string;
  cantidad?: string;
  unidad?: string;
  principioActivo?: string;
}

const RE_INVIMA = /INVIMA\s*\d{4}[MBDM]-[\d]{4,7}-R\d/i;
const RE_INVIMA_LOOSE = /\d{4}[MBDM]-[\d]{4,7}-R\d/i;
const RE_CUM_INVIMA = /\b(\d{4}[MBDM]-\d{4,7}-\d{2,3})\b/i;
const RE_CUM_NUMERIC = /\b(\d{8}-\d{2,3})\b/;
const RE_LOTE = /(?:Lote|Lot|Batch|LOTE)\s*[:\.]?\s*([A-Z0-9-]+)/i;
const RE_VENC = /(?:Venc\.?|Exp\.?|Vence|VTO)\s*[:\.]?\s*(\d{2}[\/\-.]\d{2}[\/\-.]\d{2,4}|\d{2}[\/\-.]\d{4})/i;
const RE_CONC = /(\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|UI|%)(?:\s*\/\s*\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|UI|%)?)?)/i;
const RE_LAB = /(?:Lab(?:oratorio)?\.?|Fabricante|Titular|Made by|Distribuido por)\s*[:\.]?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s.,&-]{3,80})/i;

const RE_PRESENTACION = new RegExp(
  [
    String.raw`(?:Caja|CAJA|Env(?:ase)?\.?|Frasco|FRASCO|Blister|BLISTER|Bolsa|BOLSA|Estuche|ESTUCHE|Carton|CARTON|Unidad|UNIDAD|Und\.?)`,
    String.raw`\s*(?:x|X|×|por)\s*(\d+(?:[.,]\d+)?)`,
    String.raw`(?:\s*(ml|mL|ML|mg|g|L|UI|unid(?:ades)?\.?))?`,
  ].join(''),
  'i',
);

const RE_VOL_FORM = new RegExp(
  [
    String.raw`(Suspension|SUSPENSION|Suspensión|Solucion|SOLUCION|Solución|Jarabe|JARABE|Ampolla|AMPOLLA|`,
    String.raw`Capsula|CAPSULA|Cápsula|Tableta|TABLETA|Comprimido|COMPRIMIDO|Crema|CREMA|Gel|GEL|`,
    String.raw`Polvo|POLVO|Supositorio|SUPOSITORIO|Gotas|GOTAS|Inyectable|INYECTABLE)`,
    String.raw`\s*(\d+(?:[.,]\d+)?)\s*(ml|mL|mg|g|UI|%)?`,
  ].join(''),
  'i',
);

const FORMA_KEYWORDS: Array<[RegExp, string]> = [
  [/tableta|comprimido/i, 'TABLETA'],
  [/capsula|cápsula/i, 'CAPSULA'],
  [/jarabe/i, 'JARABE'],
  [/suspension|suspensión/i, 'SUSPENSION'],
  [/solucion|solución/i, 'SOLUCION'],
  [/ampolla|inyectable/i, 'AMPOLLA'],
  [/crema/i, 'CREMA'],
  [/gel/i, 'GEL'],
  [/polvo/i, 'POLVO'],
  [/gotas/i, 'GOTAS'],
  [/supositorio/i, 'SUPOSITORIO'],
];

/** Corrige errores comunes de OCR y normaliza espacios */
export function cleanOcrText(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[|]/g, 'I')
    .replace(/[0O](?=mg|ml|g\b)/gi, (m) => (m === '0' ? '0' : 'O'))
    .replace(/\bnvima\b/gi, 'INVIMA')
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

export function parseOcrText(text: string): OcrStructuredData {
  const cleaned = cleanOcrText(text);
  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const joined = lines.join(' ');

  let registro = joined.match(RE_INVIMA)?.[0]?.replace(/\s+/g, ' ').trim();
  if (!registro) {
    const loose = joined.match(RE_INVIMA_LOOSE)?.[0];
    if (loose) registro = `INVIMA ${loose}`;
  }

  const cum = joined.match(RE_CUM_INVIMA)?.[1] ?? joined.match(RE_CUM_NUMERIC)?.[1];
  const lote = joined.match(RE_LOTE)?.[1];
  const vencimiento = joined.match(RE_VENC)?.[1];
  const concentracion = joined.match(RE_CONC)?.[1]?.replace(/\s+/g, ' ');
  const laboratorio = joined.match(RE_LAB)?.[1]?.trim();

  let presentacion: string | undefined;
  let cantidad: string | undefined;
  let unidad: string | undefined;

  const presMatch = joined.match(RE_PRESENTACION);
  if (presMatch) {
    presentacion = presMatch[0].trim();
    cantidad = presMatch[1]?.replace(',', '.');
    unidad = presMatch[2];
  }

  const volMatch = joined.match(RE_VOL_FORM);
  let formaFarmaceutica: string | undefined;
  if (volMatch) {
    formaFarmaceutica = volMatch[1]?.toUpperCase();
    if (!presentacion) {
      presentacion = volMatch[0].trim();
      cantidad = volMatch[2]?.replace(',', '.');
      unidad = volMatch[3];
    }
  }

  if (!formaFarmaceutica) {
    for (const [re, forma] of FORMA_KEYWORDS) {
      if (re.test(joined)) {
        formaFarmaceutica = forma;
        break;
      }
    }
  }

  let nombre: string | undefined;
  let principioActivo: string | undefined;

  for (const line of lines) {
    if (RE_INVIMA.test(line) || RE_INVIMA_LOOSE.test(line)) continue;
    if (RE_CUM_INVIMA.test(line) || RE_CUM_NUMERIC.test(line)) continue;
    if (RE_LOTE.test(line) || RE_VENC.test(line)) continue;
    if (RE_LAB.test(line)) continue;
    if (line.length > 3 && /[A-Za-zÁÉÍÓÚáéíóú]/.test(line)) {
      const cleanedLine = line.replace(/[®™©]/g, '').trim();
      if (!nombre) {
        nombre = cleanedLine;
      } else if (!principioActivo && similarityScore(cleanedLine, nombre) < 0.7) {
        principioActivo = cleanedLine;
        break;
      }
    }
  }

  if (nombre && concentracion && !nombre.includes(concentracion.split(' ')[0])) {
    nombre = `${nombre} ${concentracion}`.trim();
  }

  return {
    nombre,
    registroInvima: registro,
    cum,
    lote,
    vencimiento,
    concentracion,
    laboratorio,
    formaFarmaceutica,
    presentacion,
    cantidad,
    unidad,
    principioActivo,
  };
}

export function normalizeRegistro(registro: string): string {
  const trimmed = registro.trim();
  const match = trimmed.match(RE_INVIMA) ?? trimmed.match(RE_INVIMA_LOOSE);
  if (!match) return trimmed;
  const core = match[0].replace(/^INVIMA\s*/i, '');
  return `INVIMA ${core}`.replace(/\s+/g, ' ');
}

export function normalizeCum(cum: string): string {
  return cum.trim().toUpperCase();
}

export { normalizeText, similarityScore };
