/** Regla: cantidadCum + descripcionComercial → presentación visible. Consec = clave interna. */

export interface PresentacionParseResult {
  embalaje?: string;
  unidades?: string;
  resumen?: string;
}

const RE_POR_UNIDADES =
  /\b(?:POR|X|×)\s*(\d+(?:[.,]\d+)?)\s*(TABLETAS?\s*(?:RECUBIERTAS?|CUBIERTAS?)?|CAPSULAS?\s*(?:BLANDAS?|DURAS?|GEL)?|COMPRIMIDOS?\s*(?:EFERVESCENTES?|MASTICABLES?)?|AMPOLLAS?|SOBRES?|SUPOSITORIOS?|OVULOS?|GRAGEAS?)/i;

const RE_ENVASE_TIPO =
  /\b(CAJA(?:\s+PLEGADIZA)?|ENVASE|FRASCO|BLISTER|BOLSA|ESTUCHE|CARTON|AMPOLLA|VIAL|SOBRE|TUBO|BIDON)\b/i;

function capitalizeTipo(tipo: string): string {
  const t = tipo.toLowerCase().replace(/\./g, '');
  const map: Record<string, string> = {
    caja: 'Caja',
    envase: 'Envase',
    frasco: 'Frasco',
    blister: 'Blister',
    bolsa: 'Bolsa',
    estuche: 'Estuche',
    carton: 'Cartón',
    ampolla: 'Ampolla',
    vial: 'Vial',
    sobre: 'Sobre',
    tubo: 'Tubo',
    bidon: 'Bidón',
  };
  return map[t] ?? tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase();
}

function extractContainerType(descripcion: string): string {
  const env = descripcion.match(RE_ENVASE_TIPO);
  if (env) return capitalizeTipo(env[1].split(/\s+/)[0]);
  if (/\d+\s*ML/i.test(descripcion)) return 'Frasco';
  return 'Caja';
}

function extractUnitLabel(descripcion: string, formaFarmaceutica?: string | null): string {
  const porMatch = descripcion.match(RE_POR_UNIDADES);
  if (porMatch) return porMatch[2].toLowerCase().replace(/\s+/g, ' ').trim();
  if (/\d+\s*ML/i.test(descripcion)) return 'ml';
  return formaToUnidadPlural(formaFarmaceutica);
}

function formaToUnidadPlural(forma?: string | null): string {
  if (!forma) return 'unidades';
  const f = forma.toUpperCase();
  if (f.includes('TABLETA')) {
    if (f.includes('RECUB') || f.includes('CUBIERT')) return 'tabletas recubiertas';
    return 'tabletas';
  }
  if (f.includes('CAPSULA')) return 'cápsulas';
  if (f.includes('COMPRIMIDO')) return 'comprimidos';
  if (f.includes('AMPOLLA')) return 'ampollas';
  if (f.includes('SOBRE')) return 'sobres';
  if (f.includes('JARABE') || f.includes('SUSPENSION') || f.includes('SOLUCION')) return 'ml';
  return forma.toLowerCase();
}

function frascoCount(qty: string, volMl: string): string {
  if (!qty) return '1';
  const q = parseFloat(qty.replace(',', '.'));
  const v = parseFloat(volMl.replace(',', '.'));
  if (Number.isNaN(q) || Number.isNaN(v)) return qty;
  if (q === v || q > 10) return '1';
  return qty;
}

function extractVolumeMl(desc: string): string | undefined {
  const m = desc.match(/(\d+(?:[.,]\d+)?)\s*ML\.?/i);
  return m?.[1]?.replace(',', '.');
}

export function buildPresentacionComercial(
  descripcionComercial?: string | null,
  cantidadCum?: string | null,
  formaFarmaceutica?: string | null,
): string {
  const desc = descripcionComercial?.replace(/\s+/g, ' ').trim() ?? '';
  const qty = cantidadCum?.trim().replace(',', '.') ?? '';
  const forma = (formaFarmaceutica ?? '').toUpperCase();
  const container = extractContainerType(desc);
  const volMl =
    extractVolumeMl(desc) ??
    (qty &&
    /^\d+(\.\d+)?$/.test(qty) &&
    parseFloat(qty) >= 10 &&
    (forma.includes('JARABE') || forma.includes('SUSPENSION') || forma.includes('SOLUCION'))
      ? qty
      : undefined);

  const ampInDesc = desc.match(
    /(\d+(?:[.,]\d+)?)\s*AMPOLLAS?\s*(?:DE\s*)?(\d+(?:[.,]\d+)?)\s*ML/i,
  );
  if (
    ampInDesc ||
    forma.includes('INYECT') ||
    forma.includes('AMPOLLA') ||
    /\bAMPOLLA/i.test(desc)
  ) {
    const numAmp = qty || ampInDesc?.[1] || '1';
    const mlAmp = ampInDesc?.[2] || volMl || '';
    const n = parseFloat(numAmp);
    const ampLabel = n === 1 ? 'ampolla' : 'ampollas';
    if (mlAmp) return `Caja x ${numAmp} ${ampLabel} de ${mlAmp} ml`;
    return `Caja x ${numAmp} ${ampLabel}`;
  }

  const isLiquido =
    forma.includes('JARABE') ||
    forma.includes('SUSPENSION') ||
    forma.includes('SOLUCION') ||
    /\bFRASCO\b/i.test(desc);

  if (isLiquido && volMl) {
    const n = frascoCount(qty, volMl);
    return `Frasco x ${n} de ${volMl} ml`;
  }

  const unit = extractUnitLabel(desc, formaFarmaceutica);
  if (qty) return `${container} x ${qty} ${unit}`;

  const porMatch = desc.match(RE_POR_UNIDADES);
  if (porMatch) {
    return `${container} x ${porMatch[1].replace(',', '.')} ${porMatch[2].toLowerCase().trim()}`;
  }

  if (volMl) return `Frasco x 1 de ${volMl} ml`;

  if (!desc && qty && forma) {
    if (forma.includes('TABLETA') || forma.includes('CAPSULA') || forma.includes('COMPRIMIDO')) {
      return `${container} x ${qty} ${formaToUnidadPlural(formaFarmaceutica)}`;
    }
  }

  if (desc.length > 0 && desc.length <= 120) return desc;
  return 'Presentación comercial no disponible';
}

export function formatConsecutivo(consecutivo?: string | null): string {
  if (!consecutivo?.trim()) return '';
  const n = parseInt(consecutivo.trim(), 10);
  if (!Number.isNaN(n)) return String(n).padStart(2, '0');
  return consecutivo.trim();
}

export function formatCumConsec(expedienteCum?: string | null, consecutivo?: string | null): string {
  if (!expedienteCum?.trim()) return '';
  const consec = formatConsecutivo(consecutivo);
  return consec ? `${expedienteCum.trim()}-${consec}` : expedienteCum.trim();
}

export function buildEtiquetaPresentacion(info: {
  expedienteCum?: string | null;
  consecutivo?: string | null;
  descripcionComercial?: string | null;
  cantidadCum?: string | null;
  formaFarmaceutica?: string | null;
}): string {
  const cumConsec = formatCumConsec(info.expedienteCum, info.consecutivo);
  const presentacion = buildPresentacionComercial(
    info.descripcionComercial,
    info.cantidadCum,
    info.formaFarmaceutica,
  );
  if (cumConsec && presentacion !== 'Presentación comercial no disponible') {
    return `${cumConsec} | ${presentacion}`;
  }
  if (cumConsec && info.descripcionComercial?.trim()) {
    return `${cumConsec} | ${info.descripcionComercial.trim().slice(0, 80)}`;
  }
  if (cumConsec && info.cantidadCum?.trim()) {
    const fallback = buildPresentacionComercial(null, info.cantidadCum, info.formaFarmaceutica);
    if (fallback !== 'Presentación comercial no disponible') {
      return `${cumConsec} | ${fallback}`;
    }
  }
  return cumConsec || presentacion;
}

export function parseDescripcionComercial(
  text?: string | null,
  cantidadCum?: string | null,
  formaFarmaceutica?: string | null,
): PresentacionParseResult {
  const embalaje = buildPresentacionComercial(text, cantidadCum, formaFarmaceutica);
  const qtyMatch = embalaje.match(/x\s+(\d+(?:[.,]\d+)?)\s+(.+)/i);
  return {
    embalaje,
    unidades: qtyMatch ? `${qtyMatch[1]} ${qtyMatch[2]}` : undefined,
    resumen: embalaje !== 'Presentación comercial no disponible' ? embalaje : text?.slice(0, 80),
  };
}

export function buildPresentacionDisplayName(info: {
  nombreComercial?: string | null;
  descripcionComercial?: string | null;
  concentracion?: string | null;
  formaFarmaceutica?: string | null;
  cantidadCum?: string | null;
  expedienteCum?: string | null;
  consecutivo?: string | null;
}): string {
  const base = (info.nombreComercial ?? '').trim();
  const etiqueta = buildEtiquetaPresentacion(info);
  if (base && !etiqueta.startsWith(base)) return `${base} - ${etiqueta.split(' | ')[1] ?? etiqueta}`;
  return etiqueta;
}

export function consecutivoSortKey(consecutivo?: string | null): number {
  if (!consecutivo?.trim()) return 999999;
  const n = parseInt(consecutivo.trim(), 10);
  return Number.isNaN(n) ? 999999 : n;
}
