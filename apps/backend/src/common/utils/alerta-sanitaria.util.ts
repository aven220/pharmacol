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
  if (/alerta\s+sanitaria/.test(text)) {
    return 'ALERTA';
  }
  return 'OTRO';
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface MedicamentoAlertaContext {
  medicamentoId: string;
  nombreComercial: string;
  nombreNormalizado: string;
  numeroRegistro?: string;
  principiosActivos: string[];
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
    .map((p) => p.principioActivo?.nombreNormalizado ?? normalize(p.principioActivo?.nombreOficial ?? ''))
    .filter((p) => p.length >= 4);

  const nombreNorm = med.nombreNormalizado || normalize(med.nombreComercial);
  const tokens = [
    nombreNorm,
    ...nombreNorm.split(' ').filter((w) => w.length >= 4),
    ...principiosActivos,
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

  return {
    medicamentoId: med.id,
    nombreComercial: med.nombreComercial,
    nombreNormalizado: nombreNorm,
    numeroRegistro: med.registroInvima?.numeroRegistro ?? undefined,
    principiosActivos,
    tokens,
  };
}

export function scoreAlertaParaMedicamento(
  alerta: {
    titulo: string;
    tituloNorm: string;
    descripcion: string;
    tipoDocumento?: string | null;
  },
  ctx: MedicamentoAlertaContext,
): number {
  const titulo = normalize(alerta.titulo);
  const tituloNorm = alerta.tituloNorm || titulo;
  const desc = normalize(alerta.descripcion);
  let score = 0;

  if (ctx.numeroRegistro) {
    const reg = normalize(ctx.numeroRegistro);
    const regShort = reg.replace(/^invima\s*/, '');
    if (desc.includes(reg) || desc.includes(regShort)) score = Math.max(score, 1);
  }

  if (tituloNorm.includes(ctx.nombreNormalizado) || ctx.nombreNormalizado.includes(tituloNorm)) {
    score = Math.max(score, 0.92);
  }

  for (const pa of ctx.principiosActivos) {
    if (pa.length < 5) continue;
    if (tituloNorm.includes(pa) || desc.includes(pa)) {
      score = Math.max(score, 0.88);
    }
  }

  for (const token of ctx.tokens) {
    if (token.length < 5) continue;
    if (tituloNorm.includes(token)) score = Math.max(score, 0.72);
  }

  const nombreWords = ctx.nombreNormalizado.split(' ').filter((w) => w.length >= 5);
  const matchedWords = nombreWords.filter((w) => tituloNorm.includes(w) || desc.includes(w));
  if (nombreWords.length >= 2 && matchedWords.length >= 2) {
    score = Math.max(score, 0.75);
  }

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
