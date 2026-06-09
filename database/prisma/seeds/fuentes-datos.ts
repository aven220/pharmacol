import type { PrismaClient } from '@prisma/client';
import { DataSourceFormat } from '@prisma/client';

/**
 * Fuentes de datos INVIMA — Datos Abiertos Colombia (Socrata SODA API)
 * @see https://www.datos.gov.co
 */
export const DATA_SOURCES = [
  {
    codigo: 'INVIMA_CUM_VIGENTES',
    nombre: 'Código Único de Medicamentos Vigentes',
    formato: DataSourceFormat.API_SOCRATA,
    urlBase: 'https://www.datos.gov.co/resource',
    datasetId: 'i7cb-raxc',
    frecuenciaCron: '0 3 * * *',
    metadata: {
      descripcion: 'Registros sanitarios vigentes con CUM',
      columnas: [
        'registrosanitario', 'expedientecum', 'consecutivocum', 'producto',
        'descripcioncomercial', 'cantidadcum',
        'principioactivo', 'concentracion', 'formafarmaceutica',
        'titular', 'fabricante', 'importador', 'estadoregistro',
        'fechaexpedicion', 'fechavencimiento', 'estadocum',
      ],
      entidadDestino: 'medicamentos',
    },
  },
  {
    codigo: 'INVIMA_CUM_VENCIDOS',
    nombre: 'Código Único de Medicamentos Vencidos',
    formato: DataSourceFormat.API_SOCRATA,
    urlBase: 'https://www.datos.gov.co/resource',
    datasetId: 's85f-d7b9',
    frecuenciaCron: '0 4 * * 0',
    activo: false,
    metadata: {
      descripcion: 'Registros sanitarios vencidos',
      entidadDestino: 'medicamentos',
      nota: 'Dataset descontinuado en datos.gov.co — pendiente actualizar ID',
    },
  },
  {
    codigo: 'INVIMA_DISPOSITIVOS',
    nombre: 'Registros Sanitarios de Dispositivos Médicos y Otras Tecnologías',
    formato: DataSourceFormat.API_SOCRATA,
    urlBase: 'https://www.datos.gov.co/resource',
    datasetId: 'y4qt-w6tk',
    frecuenciaCron: '0 4 * * *',
    metadata: {
      descripcion: 'Dispositivos médicos, equipos biomédicos, RDIV',
      entidadDestino: 'dispositivos_medicos',
    },
  },
  {
    codigo: 'INVIMA_RSA_PDF',
    nombre: 'Listado RSA Medicamentos (PDF)',
    formato: DataSourceFormat.PDF,
    urlBase: 'https://www.invima.gov.co/sites/default/files/Tramites-y-servicios',
    datasetId: null,
    frecuenciaCron: '0 5 * * 0',
    activo: false,
    metadata: {
      descripcion: 'Listado ASS-RSA-FM179 — requiere parser PDF (fase futura)',
      entidadDestino: 'medicamentos',
    },
  },
  // Placeholders para integraciones futuras
  {
    codigo: 'SISMED',
    nombre: 'Sistema Integrado de Monitoreo de Medicamentos',
    formato: DataSourceFormat.JSON,
    urlBase: null,
    datasetId: null,
    frecuenciaCron: '0 6 * * *',
    activo: false,
    metadata: { descripcion: 'Integración futura SISMED', entidadDestino: 'medicamentos' },
  },
  {
    codigo: 'MIPRES',
    nombre: 'MIPRES — Prescripción',
    formato: DataSourceFormat.JSON,
    urlBase: null,
    datasetId: null,
    frecuenciaCron: '0 7 * * *',
    activo: false,
    metadata: { descripcion: 'Integración futura MIPRES', entidadDestino: 'medicamentos' },
  },
  {
    codigo: 'CUPS',
    nombre: 'CUPS — Procedimientos',
    formato: DataSourceFormat.CSV,
    urlBase: null,
    datasetId: null,
    frecuenciaCron: '0 8 * * 0',
    activo: false,
    metadata: { descripcion: 'Integración futura CUPS', entidadDestino: null },
  },
  {
    codigo: 'ADRES',
    nombre: 'ADRES — Afiliación y aseguramiento',
    formato: DataSourceFormat.JSON,
    urlBase: null,
    datasetId: null,
    frecuenciaCron: '0 9 * * 0',
    activo: false,
    metadata: { descripcion: 'Integración futura ADRES', entidadDestino: null },
  },
] as const;

export async function seedDataSources(prisma: PrismaClient): Promise<void> {
  console.log('  → Fuentes de datos INVIMA...');

  for (const source of DATA_SOURCES) {
    const activo = 'activo' in source ? source.activo !== false : true;

    await prisma.dataSource.upsert({
      where: { codigo: source.codigo },
      update: {
        nombre: source.nombre,
        formato: source.formato,
        urlBase: source.urlBase,
        datasetId: source.datasetId,
        frecuenciaCron: source.frecuenciaCron,
        activo,
        metadata: source.metadata as object,
      },
      create: {
        codigo: source.codigo,
        nombre: source.nombre,
        formato: source.formato,
        urlBase: source.urlBase,
        datasetId: source.datasetId,
        frecuenciaCron: source.frecuenciaCron,
        activo,
        metadata: source.metadata as object,
      },
    });
  }
}
