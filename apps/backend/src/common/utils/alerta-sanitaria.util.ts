/** Clasificación legible de tipos de comunicado INVIMA. */
export type TipoAlertaClasificado =
  | 'AGOTADO'
  | 'CARTA'
  | 'ALERTA'
  | 'INFORME_SEGURIDAD'
  | 'RETIRO'
  | 'OTRO';

export const TIPO_ALERTA_LABEL: Record<TipoAlertaClasificado, string> = {
  AGOTADO: 'Agotado / desabastecimiento',
  CARTA: 'Carta a profesionales',
  ALERTA: 'Alerta sanitaria',
  INFORME_SEGURIDAD: 'Informe de seguridad',
  RETIRO: 'Retiro / cancelación',
  OTRO: 'Comunicado INVIMA',
};

/** Palabras farmacéuticas genéricas que no deben vincular alertas. */
const STOP_TOKENS = new Set([
  'tableta',
  'tabletas',
  'capsula',
  'capsulas',
  'comprimido',
  'comprimidos',
  'recubierta',
  'recubiertas',
  'cubierta',
  'cubiertas',
  'solucion',
  'suspension',
  'inyectable',
  'inyectables',
  'jarabe',
  'crema',
  'gel',
  'unguento',
  'ampolla',
  'ampollas',
  'frasco',
  'blister',
  'caja',
  'envase',
  'medicamento',
  'medicamentos',
  'producto',
  'productos',
  'principio',
  'activo',
  'activos',
  'sanitaria',
  'sanitario',
  'alerta',
  'alertas',
  'falsificacion',
  'falsificado',
  'falsificada',
  'fraudulento',
  'fraudulenta',
  'retiro',
  'mercado',
  'invima',
  'colombia',
  'mg',
  'ml',
  'ui',
  'dosis',
  'oral',
  'via',
  'uso',
  'lote',
  'lotes',
  'fabricante',
  'laboratorio',
  'titular',
  'registro',
  'numero',
]);

export function classifyTipoAlerta(
  tipoDocumento?: string | null,
  descripcion?: string | null,
): TipoAlertaClasificado {
  const text = `${tipoDocumento ?? ''} ${descripcion ?? ''}`.toLowerCase();

  if (/agotad|desabastec|falta\s+de\s+existencia|no\s+disponible|ruptura\s+de\s+stock/.test(text)) {
    return 'AGOTADO';
  }
  if (/carta\s+(a\s+los\s+)?profesional|carta\s+a\s+la\s+comunidad|circular\s+informativa/.test(text)) {
    return 'CARTA';
  }
  if (/retiro\s+del\s+mercado|recall|cancelaci[oó]n\s+del\s+registro|suspendid/.test(text)) {
    return 'RETIRO';
  }
  if (/informe\s+de\s+seguridad|farmacovigilancia|reacci[oó]n\s+adversa/.test(text)) {
    return 'INFORME_SEGURIDAD';
  }
  if (/alerta\s+sanitaria|falsific|fraudulent/.test(text)) {
    return 'ALERTA';
  }
  return 'OTRO';
}

export function normalizeAlertaText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeAlertaText(text)
    .split(' ')
    .filter((w) => w.length >= 4 && !STOP_TOKENS.has(w));
}

function hasWord(haystack: string, needle: string): boolean {
  if (!needle || needle.length < 4) return false;
  const n = normalizeAlertaText(needle);
  if (!n) return false;
  if (STOP_TOKENS.has(n)) return false;
  const h = ` ${normalizeAlertaText(haystack)} `;
  return h.includes(` ${n} `);
}

/** Registro INVIMA exacto como token (evita coincidencias parciales de números). */
function hasRegistroExacto(haystack: string, numeroRegistro: string): boolean {
  const raw = numeroRegistro.trim();
  if (!raw) return false;
  const variants = [
    normalizeAlertaText(raw),
    normalizeAlertaText(raw.replace(/^INVIMA\s+/i, '')),
  ].filter((v, i, arr) => v.length >= 6 && arr.indexOf(v) === i);

  const h = ` ${normalizeAlertaText(haystack)} `;
  return variants.some((v) => h.includes(` ${v} `));
}

export interface MedicamentoAlertaContext {
  medicamentoId: string;
  nombreComercial: string;
  nombreNormalizado: string;
  /** Palabra distintiva del nombre comercial (más larga, no stopword). */
  primaryToken: string;
  numeroRegistro?: string;
  principiosActivos: string[];
  /** Tokens útiles para prefetch/score (sin stopwords). */
  tokens: string[];
}

export function buildMedicamentoAlertaContext(med: {
  id: string;
  nombreComercial: string;
  nombreNormalizado: string;
  registroInvima?: { numeroRegistro?: string | null } | null;
  principiosActivos?: Array<{
    principioActivo?: { nombreNormalizado?: string; nombreOficial?: string | null } | null;
  }>;
}): MedicamentoAlertaContext {
  const principiosActivos = (med.principiosActivos ?? [])
    .map((p) =>
      normalizeAlertaText(
        p.principioActivo?.nombreNormalizado ?? p.principioActivo?.nombreOficial ?? '',
      ),
    )
    .filter((p) => p.length >= 5 && !STOP_TOKENS.has(p));

  const nombreNorm = normalizeAlertaText(
    med.nombreNormalizado || med.nombreComercial,
  );
  const nameTokens = tokenize(nombreNorm);
  const primaryToken =
    [...nameTokens].sort((a, b) => b.length - a.length)[0] ??
    nombreNorm.split(' ').find((w) => w.length >= 5) ??
    nombreNorm;

  const tokens = [nombreNorm, ...nameTokens, ...principiosActivos].filter(
    (v, i, arr) => v && v.length >= 4 && !STOP_TOKENS.has(v) && arr.indexOf(v) === i,
  );

  return {
    medicamentoId: med.id,
    nombreComercial: med.nombreComercial,
    nombreNormalizado: nombreNorm,
    primaryToken,
    numeroRegistro: med.registroInvima?.numeroRegistro ?? undefined,
    principiosActivos,
    tokens,
  };
}

/**
 * Puntúa si una alerta corresponde al medicamento.
 * Umbral recomendado en servicio: >= 0.85
 */
export function scoreAlertaParaMedicamento(
  alerta: {
    titulo: string;
    tituloNorm: string;
    descripcion: string;
    tipoDocumento?: string | null;
  },
  ctx: MedicamentoAlertaContext,
): number {
  const titulo = normalizeAlertaText(alerta.titulo);
  const tituloNorm = normalizeAlertaText(alerta.tituloNorm || alerta.titulo);
  const desc = normalizeAlertaText(alerta.descripcion);
  const corpus = `${titulo} ${tituloNorm} ${desc}`;

  let score = 0;
  let matchedPrimary = false;

  // 1) Registro sanitario EXACTO (token completo)
  if (ctx.numeroRegistro && hasRegistroExacto(corpus, ctx.numeroRegistro)) {
    score = Math.max(score, 1);
    matchedPrimary = true;
  }

  // 2) Nombre comercial completo (palabra a palabra o substring fuerte en título)
  if (ctx.nombreNormalizado.length >= 5) {
    if (hasWord(tituloNorm, ctx.nombreNormalizado) || hasWord(titulo, ctx.nombreNormalizado)) {
      score = Math.max(score, 0.95);
      matchedPrimary = true;
    } else if (
      tituloNorm.includes(ctx.nombreNormalizado) ||
      titulo.includes(ctx.nombreNormalizado)
    ) {
      // Solo si el nombre del med aparece entero en el título (no al revés: evita títulos cortos genéricos)
      score = Math.max(score, 0.93);
      matchedPrimary = true;
    }
  }

  // 3) Token primario del nombre (ej. "acetaminodelt") en el TÍTULO
  if (ctx.primaryToken.length >= 5 && hasWord(tituloNorm, ctx.primaryToken)) {
    score = Math.max(score, 0.9);
    matchedPrimary = true;
  } else if (ctx.primaryToken.length >= 6 && hasWord(desc, ctx.primaryToken)) {
    // En descripción solo si es largo y palabra completa
    score = Math.max(score, 0.86);
    matchedPrimary = true;
  }

  // 4) Principio activo: debe aparecer en título O junto con token primario
  for (const pa of ctx.principiosActivos) {
    if (pa.length < 5) continue;
    if (hasWord(tituloNorm, pa) || hasWord(titulo, pa)) {
      score = Math.max(score, 0.88);
      matchedPrimary = true;
    } else if (hasWord(desc, pa) && matchedPrimary) {
      score = Math.max(score, 0.85);
    }
  }

  // 5) Varias palabras distintivas del nombre en el título
  const nombreWords = tokenize(ctx.nombreNormalizado).filter((w) => w.length >= 5);
  if (nombreWords.length >= 2) {
    const matchedInTitle = nombreWords.filter((w) => hasWord(tituloNorm, w) || hasWord(titulo, w));
    if (matchedInTitle.length >= 2) {
      score = Math.max(score, 0.9);
      matchedPrimary = true;
    }
  }

  // Sin señal del producto concreto → no vincular (evita tabletas/falsificación genéricos → Imbruvica)
  if (!matchedPrimary) return 0;

  return score;
}

export function mapAlertaConClasificacion<
  T extends {
    titulo: string;
    tituloNorm: string;
    descripcion: string;
    tipoDocumento?: string | null;
  },
>(alerta: T, relevancia: number) {
  const tipoClasificado = classifyTipoAlerta(alerta.tipoDocumento, alerta.descripcion);
  return {
    ...alerta,
    tipoClasificado,
    tipoClasificadoLabel: TIPO_ALERTA_LABEL[tipoClasificado],
    relevancia: Math.round(relevancia * 100) / 100,
  };
}
