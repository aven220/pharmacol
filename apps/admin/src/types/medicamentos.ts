export type MedicamentoSummary = {
  id: string;
  nombreComercial: string;
  numeroRegistro?: string;
  laboratorio?: string;
  concentracion?: string;
  formaFarmaceutica?: string;
  estadoRegistro?: string;
  numPresentaciones?: number;
  score?: number;
};

export type PresentacionItem = {
  id: string;
  cum?: string;
  consecutivo?: string;
  etiquetaPresentacion?: string;
  presentacionComercial?: string;
  embalaje?: string;
  descripcionProducto?: string;
  concentracion?: string;
  formaFarmaceutica?: string;
  cantidad?: string;
  unidad?: string;
  estadoRegistro?: string;
  estadoCum?: string;
  numeroRegistro?: string;
  laboratorio?: string;
  codigoBarras?: string;
};

export type PresentacionesResponse = {
  medicamento: {
    id: string;
    nombreComercial: string;
    concentracion?: string;
    formaFarmaceutica?: string;
    laboratorio?: string;
    numeroRegistro?: string;
  };
  presentaciones: PresentacionItem[];
  total: number;
};

export type MedicamentoDetail = {
  id: string;
  nombreComercial: string;
  numeroRegistro?: string;
  laboratorio?: string;
  titular?: string;
  concentracion?: string;
  formaFarmaceutica?: string;
  viaAdministracion?: string;
  estadoRegistro?: string;
  indicaciones?: string;
  contraindicaciones?: string;
  principiosActivos: string[];
  presentaciones: PresentacionItem[];
};

function mapPresentacion(raw: Record<string, unknown>): PresentacionItem {
  return {
    id: String(raw.id ?? ''),
    cum: raw.cum as string | undefined,
    consecutivo: raw.consecutivo as string | undefined,
    etiquetaPresentacion: raw.etiquetaPresentacion as string | undefined,
    presentacionComercial: raw.presentacionComercial as string | undefined,
    embalaje: raw.embalaje as string | undefined,
    descripcionProducto: raw.descripcionProducto as string | undefined,
    concentracion: raw.concentracion as string | undefined,
    formaFarmaceutica: raw.formaFarmaceutica as string | undefined,
    cantidad: raw.cantidad != null ? String(raw.cantidad) : undefined,
    unidad: raw.unidad as string | undefined,
    estadoRegistro: raw.estadoRegistro as string | undefined,
    estadoCum: raw.estadoCum as string | undefined,
    numeroRegistro: raw.numeroRegistro as string | undefined,
    laboratorio: raw.laboratorio as string | undefined,
    codigoBarras: raw.codigoBarras as string | undefined,
  };
}

export function mapMedicamentoSummary(raw: Record<string, unknown>): MedicamentoSummary {
  const registro = raw.registroInvima as Record<string, unknown> | undefined;
  const lab = raw.laboratorio as Record<string, unknown> | undefined;
  const codigos = raw.codigosCum as unknown[] | undefined;
  return {
    id: String(raw.id),
    nombreComercial: String(raw.nombreComercial ?? ''),
    numeroRegistro: (registro?.numeroRegistro as string) ?? (raw.numeroRegistro as string),
    laboratorio: (lab?.razonSocial as string) ?? (raw.laboratorio as string),
    concentracion: raw.concentracion as string | undefined,
    formaFarmaceutica: raw.formaFarmaceutica as string | undefined,
    estadoRegistro: raw.estadoRegistro as string | undefined,
    numPresentaciones:
      (raw.numPresentaciones as number) ??
      (raw._count as { codigosCum?: number })?.codigosCum ??
      codigos?.length,
    score: raw.score as number | undefined,
  };
}

export function mapMedicamentoDetail(raw: Record<string, unknown>): MedicamentoDetail {
  const registro = raw.registroInvima as Record<string, unknown> | undefined;
  const lab = raw.laboratorio as Record<string, unknown> | undefined;
  const titular = raw.titular as Record<string, unknown> | undefined;
  const principios = (raw.principiosActivos as Array<Record<string, unknown>>) ?? [];
  const presentaciones = (raw.presentaciones as Array<Record<string, unknown>>) ?? [];
  const codigosCum = (raw.codigosCum as Array<Record<string, unknown>>) ?? [];

  const presItems: PresentacionItem[] =
    codigosCum.length > 0
      ? codigosCum.map((c) =>
          mapPresentacion({
            id: c.id,
            cum: c.codigoCompleto,
            consecutivo: c.consecutivo,
            descripcionProducto: c.descripcionProducto,
            estadoCum: c.estadoCum,
            numeroRegistro: registro?.numeroRegistro,
            laboratorio: lab?.razonSocial,
            concentracion: raw.concentracion,
            formaFarmaceutica: raw.formaFarmaceutica,
            estadoRegistro: raw.estadoRegistro,
          }),
        )
      : presentaciones.map(mapPresentacion);

  return {
    id: String(raw.id),
    nombreComercial: String(raw.nombreComercial ?? ''),
    numeroRegistro: registro?.numeroRegistro as string | undefined,
    laboratorio: lab?.razonSocial as string | undefined,
    titular: titular?.razonSocial as string | undefined,
    concentracion: raw.concentracion as string | undefined,
    formaFarmaceutica: raw.formaFarmaceutica as string | undefined,
    viaAdministracion: raw.viaAdministracion as string | undefined,
    estadoRegistro: raw.estadoRegistro as string | undefined,
    indicaciones: raw.indicaciones as string | undefined,
    contraindicaciones: raw.contraindicaciones as string | undefined,
    principiosActivos: principios.map((p) => {
      const pa = p.principioActivo as Record<string, unknown> | undefined;
      const nombre = pa?.nombreOficial ?? pa?.nombreNormalizado ?? '';
      const conc = p.concentracion ? ` (${p.concentracion})` : '';
      return `${nombre}${conc}`;
    }),
    presentaciones: presItems,
  };
}
