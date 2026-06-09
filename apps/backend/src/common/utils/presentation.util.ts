/** Extrae embalaje comercial: Caja x 10, Frasco x 120 ml, etc. */
export interface EmbalajeInfo {
  embalaje?: string;
  cantidad?: string;
  unidad?: string;
  presentacionComercial?: string;
}

const RE_EMBALAJE = new RegExp(
  [
    String.raw`(Caja|CAJA|Env(?:ase)?\.?|Frasco|FRASCO|Blister|BLISTER|Bolsa|BOLSA|Estuche|ESTUCHE|`,
    String.raw`Carton|CARTON|Unidad|UNIDAD|Und\.?|Ampolla|AMPOLLA|Frasco\s*Gotero|Gotero|GOTERO|`,
    String.raw`Bolsa\s*Recoc(?:hable|hable)|Sobre|SOBRE|Vial|VIAL|Jeringa|JERINGA)`,
    String.raw`\s*(?:x|X|×|por|de)\s*(\d+(?:[.,]\d+)?)`,
    String.raw`(?:\s*(ml|mL|ML|mg|g|G|L|UI|u\.?i\.?|unid(?:ades)?\.?|tab(?:letas)?\.?|cap(?:sulas)?\.?|amp(?:ollas)?\.?))?`,
  ].join(''),
  'i',
);

const RE_VOL_ONLY = /(\d+(?:[.,]\d+)?)\s*(ml|mL|mg|g|UI)\b/i;

const RE_POR_UNIDADES =
  /\b(?:POR|X|×)\s*(\d+(?:[.,]\d+)?)\s*(TABLETAS?\s*(?:RECUBIERTAS?|CUBIERTAS?)?|CAPSULAS?\s*(?:BLANDAS?|DURAS?|GEL)?|COMPRIMIDOS?\s*(?:EFERVESCENTES?|MASTICABLES?|DISPERSABLES?)?|AMPOLLAS?|SOBRES?|SUPOSITORIOS?|OVULOS?|GRAGEAS?|PARCHES?|JERINGAS?)/i;

const RE_ENVASE_TIPO =
  /\b(CAJA(?:\s+PLEGADIZA)?|ENVASE|FRASCO|BLISTER|BOLSA|ESTUCHE|CARTON|AMPOLLA|VIAL|SOBRE|TUBO|BIDON)\b/i;

const RE_FRASCO_ML =
  /\b(?:POR|X|×)\s*(\d+(?:[.,]\d+)?)\s*(ML\.?)\b|(?:^|\s)(\d+(?:[.,]\d+)?)\s*(ML\.?)\b/i;

/** En jarabes INVIMA suele enviar cantidadCum = volumen (ml), no número de frascos. */
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

export interface PresentacionParseResult {
  embalaje?: string;
  unidades?: string;
  resumen?: string;
}

function extractContainerType(descripcion: string): string {
  const env = descripcion.match(RE_ENVASE_TIPO);
  if (env) return capitalizeTipo(env[1].split(/\s+/)[0]);
  if (RE_FRASCO_ML.test(descripcion)) return 'Frasco';
  return 'Caja';
}

function extractUnitLabel(descripcion: string, formaFarmaceutica?: string | null): string {
  const porMatch = descripcion.match(RE_POR_UNIDADES);
  if (porMatch) return porMatch[2].toLowerCase().replace(/\s+/g, ' ').trim();
  if (RE_FRASCO_ML.test(descripcion)) return 'ml';
  return formaToUnidadPlural(formaFarmaceutica);
}

/** cantidadCum + descripcionComercial → "Caja x 10 tabletas", "Frasco x 1 de 60 ml" */
export function buildPresentacionComercial(
  descripcionComercial?: string | null,
  cantidadCum?: string | null,
  formaFarmaceutica?: string | null,
): string {
  const desc = descripcionComercial?.replace(/\s+/g, ' ').trim() ?? '';
  const qty = cantidadCum?.trim().replace(',', '.') ?? '';
  const forma = (formaFarmaceutica ?? '').toUpperCase();
  const container = extractContainerType(desc);
  const volMl = extractVolumeMl(desc) ?? (qty && /^\d+(\.\d+)?$/.test(qty) && parseFloat(qty) >= 10 && (forma.includes('JARABE') || forma.includes('SUSPENSION') || forma.includes('SOLUCION')) ? qty : undefined);

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
  if (qty) {
    return `${container} x ${qty} ${unit}`;
  }

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

/** Ej: 52477-01 */
export function formatCumConsec(expedienteCum?: string | null, consecutivo?: string | null): string {
  if (!expedienteCum?.trim()) return '';
  const consec = formatConsecutivo(consecutivo);
  return consec ? `${expedienteCum.trim()}-${consec}` : expedienteCum.trim();
}

/** Ej: 52477-01 | Frasco x 1 de 60 ml */
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

function consecutivoSortKey(consecutivo?: string | null): number {
  if (!consecutivo?.trim()) return 999999;
  const n = parseInt(consecutivo.trim(), 10);
  return Number.isNaN(n) ? 999999 : n;
}

export function parseDescripcionComercial(
  text?: string | null,
  cantidadCum?: string | null,
  formaFarmaceutica?: string | null,
): PresentacionParseResult {
  const embalaje = buildPresentacionComercial(text, cantidadCum, formaFarmaceutica);
  const qtyMatch = embalaje.match(/por\s+(\d+(?:[.,]\d+)?)\s+(.+)/i);
  return {
    embalaje,
    unidades: qtyMatch ? `${qtyMatch[1]} ${qtyMatch[2]}` : undefined,
    resumen: embalaje !== 'Presentación comercial no disponible' ? embalaje : text?.slice(0, 80),
  };
}

function summarizeCommercialDesc(text: string): string {
  const por = text.match(RE_POR_UNIDADES);
  if (por) return `${por[1]} ${por[2].toUpperCase()}`;
  const short = text.slice(0, 80);
  return short.length < text.length ? `${short}…` : short;
}

function unidadesFromCantidadCum(cantidad: string, forma?: string | null): string {
  const n = cantidad.replace(',', '.');
  if (!forma) return n;
  const f = forma.toUpperCase();
  if (f.includes('TABLETA')) {
    if (f.includes('RECUB') || f.includes('CUBIERT')) return `${n} TABLETAS RECUBIERTAS`;
    return `${n} TABLETAS`;
  }
  if (f.includes('CAPSULA')) return `${n} CÁPSULAS`;
  if (f.includes('COMPRIMIDO')) return `${n} COMPRIMIDOS`;
  if (f.includes('AMPOLLA')) return `${n} AMPOLLAS`;
  if (f.includes('JARABE') || f.includes('SOLUCION') || f.includes('SUSPENSION')) {
    return `${n} UNIDAD`;
  }
  return `${n} ${f}`;
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
  if (f.includes('SUPOSITORIO')) return 'supositorios';
  if (f.includes('JARABE') || f.includes('SUSPENSION') || f.includes('SOLUCION')) return 'ml';
  return forma.toLowerCase();
}

export function formatEmbalajeComercial(
  _parsed: PresentacionParseResult,
  formaFarmaceutica?: string | null,
  cantidadCum?: string | null,
  descripcionComercial?: string | null,
): string {
  return buildPresentacionComercial(descripcionComercial, cantidadCum, formaFarmaceutica);
}

/** Etiqueta: "ACETAMINOFEN 500 MG - Caja por 20 tabletas" */
export function buildPresentacionDisplayName(info: {
  nombreComercial?: string | null;
  descripcionComercial?: string | null;
  concentracion?: string | null;
  formaFarmaceutica?: string | null;
  cantidadCum?: string | null;
}): string {
  const base = (info.nombreComercial ?? '').trim();
  const presentacion = buildPresentacionComercial(
    info.descripcionComercial,
    info.cantidadCum,
    info.formaFarmaceutica,
  );
  if (base && presentacion !== 'Presentación comercial no disponible') {
    return `${base} - ${presentacion}`;
  }
  if (presentacion !== 'Presentación comercial no disponible') return presentacion;
  if (base && info.concentracion && !base.toUpperCase().includes(info.concentracion.toUpperCase())) {
    return `${base} ${info.concentracion}`.trim();
  }
  return base || 'Presentación comercial no disponible';
}

export function extractEmbalaje(text?: string | null): EmbalajeInfo {
  if (!text?.trim()) return {};

  const normalized = text.replace(/\s+/g, ' ').trim();
  const match = normalized.match(RE_EMBALAJE);

  if (match) {
    const tipo = match[1];
    const cantidad = match[2]?.replace(',', '.');
    const unidad = match[3];
    const embalaje = `${capitalizeTipo(tipo)} x ${cantidad}${unidad ? ` ${unidad}` : ''}`;
    return {
      embalaje,
      cantidad,
      unidad: unidad ?? undefined,
      presentacionComercial: embalaje,
    };
  }

  const vol = normalized.match(RE_VOL_ONLY);
  if (vol) {
    return {
      embalaje: `${vol[1]} ${vol[2]}`,
      cantidad: vol[1],
      unidad: vol[2],
    };
  }

  return { presentacionComercial: normalized.slice(0, 120) };
}

function capitalizeTipo(tipo: string): string {
  const t = tipo.toLowerCase().replace(/\./g, '');
  const map: Record<string, string> = {
    caja: 'Caja',
    env: 'Envase',
    envase: 'Envase',
    frasco: 'Frasco',
    blister: 'Blister',
    bolsa: 'Bolsa',
    estuche: 'Estuche',
    carton: 'Cartón',
    unidad: 'Unidad',
    und: 'Unidad',
    ampolla: 'Ampolla',
    gotero: 'Gotero',
    sobre: 'Sobre',
    vial: 'Vial',
    jeringa: 'Jeringa',
  };
  return map[t] ?? tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase();
}

/** Texto legible para listado de presentaciones */
export function formatPresentacionLabel(info: {
  descripcion?: string | null;
  nombreComercial?: string | null;
  concentracion?: string | null;
  formaFarmaceutica?: string | null;
  cantidadCum?: string | null;
}): string {
  return buildPresentacionDisplayName({
    nombreComercial: info.nombreComercial,
    descripcionComercial: info.descripcion,
    concentracion: info.concentracion,
    formaFarmaceutica: info.formaFarmaceutica,
    cantidadCum: info.cantidadCum,
  });
}

export interface PresentacionDto {
  id: string;
  cum?: string;
  consecutivo?: string;
  expedienteCum?: string;
  concentracion?: string;
  formaFarmaceutica?: string;
  cantidad?: string;
  unidad?: string;
  embalaje?: string;
  unidades?: string;
  descripcionProducto?: string;
  presentacionComercial?: string;
  cumConsec?: string;
  etiquetaPresentacion?: string;
  estadoRegistro?: string;
  estadoCum?: string;
  numeroRegistro?: string;
  laboratorio?: string;
  codigoBarras?: string;
}

function embalajeSortKey(embalaje?: string): number {
  if (!embalaje) return 999999;
  const m = embalaje.match(/(?:por|x)\s*(\d+(?:[.,]\d+)?)/i);
  return m ? parseFloat(m[1].replace(',', '.')) : 999999;
}

/** Construye lista de presentaciones desde medicamento + CUMs + presentaciones DB */
export function buildPresentacionesItems(med: {
  id: string;
  nombreComercial: string;
  concentracion?: string | null;
  formaFarmaceutica?: string | null;
  estadoRegistro?: string;
  laboratorio?: { razonSocial?: string | null } | null;
  registroInvima?: { numeroRegistro?: string | null } | null;
  codigosCum: Array<{
    id: string;
    codigoCompleto: string;
    consecutivo: string;
    expedienteCum: string;
    estadoCum?: string | null;
    descripcionProducto?: string | null;
  }>;
  presentaciones: Array<{
    id: string;
    descripcion: string;
    codigoCum?: string | null;
    cantidad?: unknown;
    unidad?: string | null;
    codigoBarras?: string | null;
  }>;
}): PresentacionDto[] {
  const numeroRegistro = med.registroInvima?.numeroRegistro ?? undefined;
  const laboratorio = med.laboratorio?.razonSocial ?? undefined;
  const estadoRegistro = med.estadoRegistro;

  if (med.codigosCum.length === 0 && med.presentaciones.length === 0) {
    return [
      {
        id: med.id,
        presentacionComercial: med.nombreComercial,
        concentracion: med.concentracion ?? undefined,
        formaFarmaceutica: med.formaFarmaceutica ?? undefined,
        estadoRegistro,
        numeroRegistro,
        laboratorio,
      },
    ];
  }

  const items: PresentacionDto[] = med.codigosCum.map((cum) => {
    const matching = med.presentaciones.find((p) => p.codigoCum === cum.codigoCompleto);
    const descripcionProducto =
      cum.descripcionProducto?.trim() || matching?.descripcion?.trim() || undefined;
    const cantidadCum =
      matching?.cantidad != null ? String(matching.cantidad) : undefined;
    const parsed = parseDescripcionComercial(
      descripcionProducto,
      cantidadCum,
      med.formaFarmaceutica,
    );
    const embalajeComercial = buildPresentacionComercial(
      descripcionProducto,
      cantidadCum,
      med.formaFarmaceutica,
    );
    const cumConsec = formatCumConsec(cum.expedienteCum, cum.consecutivo);
    const etiquetaPresentacion = buildEtiquetaPresentacion({
      expedienteCum: cum.expedienteCum,
      consecutivo: cum.consecutivo,
      descripcionComercial: descripcionProducto,
      cantidadCum,
      formaFarmaceutica: med.formaFarmaceutica,
    });
    return {
      id: cum.id,
      cum: cum.codigoCompleto,
      consecutivo: cum.consecutivo,
      expedienteCum: cum.expedienteCum,
      estadoCum: cum.estadoCum ?? undefined,
      descripcionProducto,
      embalaje: embalajeComercial,
      unidades: parsed.unidades,
      cumConsec,
      etiquetaPresentacion,
      concentracion: med.concentracion ?? undefined,
      formaFarmaceutica: med.formaFarmaceutica ?? undefined,
      cantidad: cantidadCum,
      unidad: matching?.unidad ?? med.formaFarmaceutica ?? undefined,
      presentacionComercial: etiquetaPresentacion,
      estadoRegistro,
      numeroRegistro,
      laboratorio,
      codigoBarras: matching?.codigoBarras ?? undefined,
    };
  });

  for (const pres of med.presentaciones) {
    if (pres.codigoCum && items.some((i) => i.cum === pres.codigoCum)) continue;
    const descripcion = pres.descripcion?.trim() || undefined;
    const cantidadCum = pres.cantidad != null ? String(pres.cantidad) : undefined;
    const parsed = parseDescripcionComercial(descripcion, cantidadCum, med.formaFarmaceutica);
    const embalajeComercial = buildPresentacionComercial(
      descripcion,
      cantidadCum,
      med.formaFarmaceutica,
    );
    const etiquetaPresentacion = buildEtiquetaPresentacion({
      descripcionComercial: descripcion,
      cantidadCum,
      formaFarmaceutica: med.formaFarmaceutica,
    });
    items.push({
      id: pres.id,
      cum: pres.codigoCum ?? undefined,
      descripcionProducto: descripcion,
      embalaje: embalajeComercial,
      unidades: parsed.unidades,
      etiquetaPresentacion,
      concentracion: med.concentracion ?? undefined,
      formaFarmaceutica: med.formaFarmaceutica ?? undefined,
      cantidad: cantidadCum,
      unidad: pres.unidad ?? med.formaFarmaceutica ?? undefined,
      presentacionComercial: etiquetaPresentacion,
      estadoRegistro,
      numeroRegistro,
      laboratorio,
      codigoBarras: pres.codigoBarras ?? undefined,
    });
  }

  return items.sort(
    (a, b) => consecutivoSortKey(a.consecutivo) - consecutivoSortKey(b.consecutivo),
  );
}
