import type { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  DataOrigin,
  DeviceRiskClass,
  LaboratoryType,
  ProductType,
  RegistrationStatus,
} from '@prisma/client';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function hashContent(obj: object): string {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

/**
 * Datos demo para desarrollo — NO son datos oficiales INVIMA.
 * En producción los medicamentos provienen exclusivamente del sync ETL.
 */
export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  console.log('  → Datos demo (desarrollo)...');

  const existing = await prisma.medicamento.count();
  if (existing > 0) {
    console.log('    (omitido: ya existen medicamentos)');
    return;
  }

  // Laboratorios demo
  const procaps = await prisma.laboratory.create({
    data: {
      nit: '8600012345',
      razonSocial: 'PROCAPS S.A.',
      nombreComercial: 'Procaps',
      tipo: LaboratoryType.FABRICANTE,
    },
  });

  const genfar = await prisma.laboratory.create({
    data: {
      nit: '8600056789',
      razonSocial: 'GENFAR S.A.',
      nombreComercial: 'Genfar',
      tipo: LaboratoryType.FABRICANTE,
    },
  });

  const laSante = await prisma.laboratory.create({
    data: {
      nit: '8600098765',
      razonSocial: 'LABORATORIOS LA SANTÉ S.A.',
      nombreComercial: 'La Santé',
      tipo: LaboratoryType.FABRICANTE,
    },
  });

  // Principios activos
  const cetirizina = await prisma.activeIngredient.create({
    data: {
      nombreNormalizado: normalize('CETIRIZINA DICLORHIDRATO'),
      nombreOficial: 'CETIRIZINA DICLORHIDRATO',
      dci: true,
    },
  });

  const azitromicina = await prisma.activeIngredient.create({
    data: {
      nombreNormalizado: normalize('AZITROMICINA DIHIDRATO'),
      nombreOficial: 'AZITROMICINA DIHIDRATO',
      dci: true,
    },
  });

  const losartan = await prisma.activeIngredient.create({
    data: {
      nombreNormalizado: normalize('LOSARTÁN POTÁSICO'),
      nombreOficial: 'LOSARTÁN POTÁSICO',
      dci: true,
    },
  });

  // Medicamento 1: ALERCET
  const registroAlercet = await prisma.invimaRegistration.create({
    data: {
      numeroRegistro: 'INVIMA 2021M-002103-R3',
      expediente: '3521',
      fechaExpedicion: new Date('2021-03-15'),
      fechaVencimiento: new Date('2026-03-15'),
      estado: 'Vigente',
      modalidad: 'FABRICAR Y VENDER',
      tipoProducto: ProductType.MEDICAMENTO,
    },
  });

  const medAlercet = await prisma.medicamento.create({
    data: {
      nombreComercial: 'ALERCET® JARABE',
      nombreNormalizado: normalize('ALERCET JARABE'),
      concentracion: '5 mg/5 mL',
      formaFarmaceutica: 'JARABE',
      viaAdministracion: 'ORAL',
      laboratorioId: procaps.id,
      titularId: procaps.id,
      registroInvimaId: registroAlercet.id,
      atcCodigo: 'R06AE07',
      estadoRegistro: RegistrationStatus.VIGENTE,
      fechaVencimiento: new Date('2026-03-15'),
      indicaciones: 'Tratamiento de manifestaciones alérgicas.',
      contraindicaciones: 'Hipersensibilidad al principio activo.',
      fuente: DataOrigin.MANUAL,
      hashContenido: hashContent({ nombre: 'ALERCET', registro: 'INVIMA 2021M-002103-R3' }),
      principiosActivos: {
        create: {
          principioActivoId: cetirizina.id,
          concentracion: '5 mg/5 mL',
          esPrincipal: true,
        },
      },
      presentaciones: {
        create: {
          descripcion: 'Frasco x 120 mL',
          codigoCum: '12345678-001',
        },
      },
      codigosCum: {
        create: {
          expedienteCum: '12345678',
          consecutivo: '001',
          codigoCompleto: '12345678-001',
          estadoCum: 'Vigente',
        },
      },
    },
  });

  // Medicamento 2: AZITROMICINA GENFAR
  const registroAzitro = await prisma.invimaRegistration.create({
    data: {
      numeroRegistro: 'INVIMA 2022M-002521-R3',
      expediente: '11701',
      fechaExpedicion: new Date('2022-06-01'),
      fechaVencimiento: new Date('2027-06-01'),
      estado: 'Vigente',
      modalidad: 'FABRICAR Y VENDER',
      tipoProducto: ProductType.MEDICAMENTO,
    },
  });

  await prisma.medicamento.create({
    data: {
      nombreComercial: 'AZITROMICINA POLVO PARA SUSPENSIÓN 200 MG/5ML',
      nombreNormalizado: normalize('AZITROMICINA POLVO PARA SUSPENSION 200 MG/5ML'),
      concentracion: '200 mg/5 mL',
      formaFarmaceutica: 'POLVO PARA SUSPENSIÓN',
      viaAdministracion: 'ORAL',
      laboratorioId: genfar.id,
      titularId: genfar.id,
      registroInvimaId: registroAzitro.id,
      atcCodigo: 'J01FA09',
      estadoRegistro: RegistrationStatus.VIGENTE,
      fechaVencimiento: new Date('2027-06-01'),
      fuente: DataOrigin.MANUAL,
      hashContenido: hashContent({ nombre: 'AZITROMICINA', registro: 'INVIMA 2022M-002521-R3' }),
      principiosActivos: {
        create: {
          principioActivoId: azitromicina.id,
          concentracion: '200 mg/5 mL',
          esPrincipal: true,
        },
      },
      codigosCum: {
        create: {
          expedienteCum: '23456789',
          consecutivo: '001',
          codigoCompleto: '23456789-001',
          estadoCum: 'Vigente',
        },
      },
    },
  });

  // Medicamento 3: LOSARTÁN
  const registroLosartan = await prisma.invimaRegistration.create({
    data: {
      numeroRegistro: 'INVIMA 2020M-001234-R2',
      expediente: '8901',
      fechaExpedicion: new Date('2020-01-10'),
      fechaVencimiento: new Date('2025-01-10'),
      estado: 'Vigente',
      modalidad: 'FABRICAR Y VENDER',
      tipoProducto: ProductType.MEDICAMENTO,
    },
  });

  await prisma.medicamento.create({
    data: {
      nombreComercial: 'LOSARTÁN 50 MG TABLETAS',
      nombreNormalizado: normalize('LOSARTAN 50 MG TABLETAS'),
      concentracion: '50 mg',
      formaFarmaceutica: 'TABLETA',
      viaAdministracion: 'ORAL',
      laboratorioId: laSante.id,
      titularId: laSante.id,
      registroInvimaId: registroLosartan.id,
      atcCodigo: 'C09CA01',
      estadoRegistro: RegistrationStatus.VIGENTE,
      fuente: DataOrigin.MANUAL,
      hashContenido: hashContent({ nombre: 'LOSARTAN', registro: 'INVIMA 2020M-001234-R2' }),
      principiosActivos: {
        create: {
          principioActivoId: losartan.id,
          concentracion: '50 mg',
          esPrincipal: true,
        },
      },
    },
  });

  // Dispositivo médico demo
  const registroDM = await prisma.invimaRegistration.create({
    data: {
      numeroRegistro: 'INVIMA 2018DM-000456-R1',
      expediente: 'DM-456',
      fechaExpedicion: new Date('2018-05-20'),
      fechaVencimiento: new Date('2028-05-20'),
      estado: 'Vigente',
      modalidad: 'IMPORTAR Y VENDER',
      tipoProducto: ProductType.DISPOSITIVO,
    },
  });

  await prisma.dispositivoMedico.create({
    data: {
      nombre: 'TENSIÓMETRO DIGITAL DE BRAZO AUTOMÁTICO',
      descripcion: 'Dispositivo médico para medición de presión arterial.',
      registroInvimaId: registroDM.id,
      fabricanteId: procaps.id,
      importadorId: procaps.id,
      claseRiesgo: DeviceRiskClass.IIa,
      estadoRegistro: RegistrationStatus.VIGENTE,
      categoria: 'Dispositivo médico de medición',
      fuente: DataOrigin.MANUAL,
      hashContenido: hashContent({ nombre: 'TENSIOMETRO', registro: 'INVIMA 2018DM-000456-R1' }),
    },
  });

  console.log(`    ✓ Medicamento demo: ${medAlercet.nombreComercial}`);
}
