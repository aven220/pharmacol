import {
  buildEtiquetaPresentacion,
  buildPresentacionComercial,
  buildPresentacionDisplayName,
  consecutivoSortKey,
  formatCumConsec,
  parseDescripcionComercial,
} from '@/utils/presentation';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  roles: string[];
  permissions: string[];
}

export interface MedicamentoSummary {
  id: string;
  nombreComercial: string;
  concentracion?: string;
  formaFarmaceutica?: string;
  estadoRegistro?: string;
  numeroRegistro?: string;
  laboratorio?: string;
  numPresentaciones?: number;
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

export interface MedicamentoSuggest {
  id: string;
  nombreComercial: string;
  numeroRegistro?: string;
  laboratorio?: string;
  concentracion?: string;
  formaFarmaceutica?: string;
  estadoRegistro?: string;
  score?: number;
  matchType?: string;
  numPresentaciones?: number;
}

export interface PresentacionItem {
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

export interface PresentacionesResponse {
  medicamento: MedicamentoSummary;
  presentaciones: PresentacionItem[];
  total: number;
}

export interface MedicamentoDetail {
  id: string;
  nombreComercial: string;
  concentracion?: string;
  formaFarmaceutica?: string;
  estadoRegistro?: string;
  viaAdministracion?: string;
  indicaciones?: string;
  contraindicaciones?: string;
  numeroRegistro?: string;
  laboratorio?: string;
  titular?: string;
  principiosActivos: string[];
  presentaciones: PresentacionItem[];
}

export interface IaMatch {
  medicamentoId?: string;
  presentacionId?: string;
  nombreComercial?: string;
  presentacionComercial?: string;
  concentracion?: string;
  formaFarmaceutica?: string;
  cantidad?: string;
  laboratorio?: string;
  score: number;
  numeroRegistro?: string;
  cum?: string;
  matchType?: string;
  matchLevel?: 'exacta' | 'muy_alta' | 'alta' | 'media';
  embalaje?: string;
}

export interface IaResult {
  coincidencias: IaMatch[];
  confianzaGlobal: number;
  inconsistencias?: string[];
  alertaRiesgo?: string;
  presentaciones?: IaMatch[];
}

export function matchLevelLabel(level?: IaMatch['matchLevel'], score?: number): string {
  if (level === 'exacta' || (score ?? 0) >= 0.995) return 'Coincidencia exacta';
  if (level === 'muy_alta' || (score ?? 0) >= 0.95) return 'Coincidencia muy alta';
  if (level === 'alta' || (score ?? 0) >= 0.9) return 'Coincidencia alta';
  return 'Coincidencia media';
}

export function mapMedicamentoSummary(raw: Record<string, unknown>): MedicamentoSummary {
  const registro = raw.registroInvima as Record<string, unknown> | undefined;
  const lab = raw.laboratorio as Record<string, unknown> | undefined;
  const codigosCum = raw.codigosCum as unknown[] | undefined;
  const count = raw._count as { codigosCum?: number } | undefined;
  const numPresentaciones =
    typeof raw.numPresentaciones === 'number'
      ? raw.numPresentaciones
      : count?.codigosCum ?? (Array.isArray(codigosCum) ? codigosCum.length : undefined);

  return {
    id: String(raw.id),
    nombreComercial: String(raw.nombreComercial ?? ''),
    concentracion: raw.concentracion as string | undefined,
    formaFarmaceutica: raw.formaFarmaceutica as string | undefined,
    estadoRegistro: raw.estadoRegistro as string | undefined,
    numeroRegistro: (registro?.numeroRegistro ?? raw.numeroRegistro) as string | undefined,
    laboratorio: (lab?.razonSocial ?? raw.laboratorio) as string | undefined,
    numPresentaciones: numPresentaciones && numPresentaciones > 0 ? numPresentaciones : undefined,
  };
}

function embalajeSortKey(embalaje?: string): number {
  if (!embalaje) return 999999;
  const m = embalaje.match(/(?:por|x)\s*(\d+(?:[.,]\d+)?)/i);
  return m ? parseFloat(m[1].replace(',', '.')) : 999999;
}

export function buildPresentaciones(raw: Record<string, unknown>): PresentacionItem[] {
  const codigosCum = (raw.codigosCum as Array<Record<string, unknown>>) ?? [];
  const presentaciones = (raw.presentaciones as Array<Record<string, unknown>>) ?? [];
  const registro = raw.registroInvima as Record<string, unknown> | undefined;
  const lab = raw.laboratorio as Record<string, unknown> | undefined;
  const numeroRegistro = registro?.numeroRegistro as string | undefined;
  const estadoRegistro = raw.estadoRegistro as string | undefined;
  const laboratorio = (lab?.razonSocial ?? raw.laboratorio) as string | undefined;

  if (codigosCum.length === 0 && presentaciones.length === 0) {
    return [
      {
        id: String(raw.id),
        presentacionComercial: String(raw.nombreComercial ?? ''),
        concentracion: raw.concentracion as string | undefined,
        formaFarmaceutica: raw.formaFarmaceutica as string | undefined,
        estadoRegistro,
        numeroRegistro,
        laboratorio,
      },
    ];
  }

  const items: PresentacionItem[] = codigosCum.map((cum) => {
    const codigoCompleto = String(cum.codigoCompleto ?? '');
    const matching = presentaciones.find((p) => p.codigoCum === codigoCompleto);
    const descripcionProducto = String(
      cum.descripcionProducto ?? matching?.descripcion ?? '',
    ).trim() || undefined;
    const cantidadCum =
      matching?.cantidad != null ? String(matching.cantidad) : undefined;
    const parsed = parseDescripcionComercial(
      descripcionProducto,
      cantidadCum,
      raw.formaFarmaceutica as string | undefined,
    );
    const embalajeComercial = buildPresentacionComercial(
      descripcionProducto,
      cantidadCum,
      raw.formaFarmaceutica as string | undefined,
    );
    const cumConsec = formatCumConsec(cum.expedienteCum as string | undefined, cum.consecutivo as string | undefined);
    const etiquetaPresentacion = buildEtiquetaPresentacion({
      expedienteCum: cum.expedienteCum as string | undefined,
      consecutivo: cum.consecutivo as string | undefined,
      descripcionComercial: descripcionProducto,
      cantidadCum,
      formaFarmaceutica: raw.formaFarmaceutica as string | undefined,
    });

    return {
      id: String(cum.id ?? codigoCompleto),
      cum: codigoCompleto,
      consecutivo: cum.consecutivo as string | undefined,
      expedienteCum: cum.expedienteCum as string | undefined,
      estadoCum: cum.estadoCum as string | undefined,
      descripcionProducto,
      embalaje: embalajeComercial,
      unidades: parsed.unidades,
      cumConsec,
      etiquetaPresentacion,
      concentracion: raw.concentracion as string | undefined,
      formaFarmaceutica: raw.formaFarmaceutica as string | undefined,
      cantidad: cantidadCum,
      unidad: (matching?.unidad as string | undefined) ?? (raw.formaFarmaceutica as string | undefined),
      presentacionComercial: etiquetaPresentacion,
      estadoRegistro,
      numeroRegistro,
      laboratorio,
      codigoBarras: matching?.codigoBarras as string | undefined,
    };
  });

  for (const pres of presentaciones) {
    const codigoCum = pres.codigoCum as string | undefined;
    if (codigoCum && items.some((i) => i.cum === codigoCum)) continue;
    const descripcion = String(pres.descripcion ?? '').trim() || undefined;
    const cantidadCum = pres.cantidad != null ? String(pres.cantidad) : undefined;
    const parsed = parseDescripcionComercial(
      descripcion,
      cantidadCum,
      raw.formaFarmaceutica as string | undefined,
    );
    const embalajeComercial = buildPresentacionComercial(
      descripcion,
      cantidadCum,
      raw.formaFarmaceutica as string | undefined,
    );
    const etiquetaPresentacion = buildEtiquetaPresentacion({
      descripcionComercial: descripcion,
      cantidadCum,
      formaFarmaceutica: raw.formaFarmaceutica as string | undefined,
    });
    items.push({
      id: String(pres.id),
      cum: codigoCum,
      descripcionProducto: descripcion,
      embalaje: embalajeComercial,
      unidades: parsed.unidades,
      etiquetaPresentacion,
      concentracion: raw.concentracion as string | undefined,
      formaFarmaceutica: raw.formaFarmaceutica as string | undefined,
      cantidad: cantidadCum,
      unidad: (pres.unidad as string | undefined) ?? (raw.formaFarmaceutica as string | undefined),
      presentacionComercial: etiquetaPresentacion,
      estadoRegistro,
      numeroRegistro,
      laboratorio,
      codigoBarras: pres.codigoBarras as string | undefined,
    });
  }

  return items.sort((a, b) => consecutivoSortKey(a.consecutivo) - consecutivoSortKey(b.consecutivo));
}

export function mapMedicamentoDetail(raw: Record<string, unknown>): MedicamentoDetail {
  const registro = raw.registroInvima as Record<string, unknown> | undefined;
  const lab = raw.laboratorio as Record<string, unknown> | undefined;
  const titular = raw.titular as Record<string, unknown> | undefined;
  const principios = (raw.principiosActivos as Array<Record<string, unknown>>) ?? [];

  return {
    id: String(raw.id),
    nombreComercial: String(raw.nombreComercial ?? ''),
    concentracion: raw.concentracion as string | undefined,
    formaFarmaceutica: raw.formaFarmaceutica as string | undefined,
    estadoRegistro: raw.estadoRegistro as string | undefined,
    viaAdministracion: raw.viaAdministracion as string | undefined,
    indicaciones: raw.indicaciones as string | undefined,
    contraindicaciones: raw.contraindicaciones as string | undefined,
    numeroRegistro: registro?.numeroRegistro as string | undefined,
    laboratorio: lab?.razonSocial as string | undefined,
    titular: titular?.razonSocial as string | undefined,
    principiosActivos: principios.map((p) => {
      const pa = p.principioActivo as Record<string, unknown> | undefined;
      return String(pa?.nombreOficial ?? '—');
    }),
    presentaciones: buildPresentaciones(raw),
  };
}
