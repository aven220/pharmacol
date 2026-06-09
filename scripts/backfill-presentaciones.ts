/**
 * Rellena descripcion_producto y presentaciones faltantes desde INVIMA (datos.gov.co).
 * Uso: pnpm backfill:presentaciones
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DATASET = 'i7cb-raxc';
const BATCH = 500;
const MAX_DESCRIPCION = 500;
const MAX_UNIDAD = 50;

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value?.trim()) return null;
  const t = value.trim();
  return t.length <= max ? t : t.slice(0, max);
}

function pickField(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = record[key];
    if (val != null && String(val).trim() && String(val).toLowerCase() !== 'null') {
      return String(val).trim();
    }
  }
  return undefined;
}

async function fetchInvimaByExpediente(expediente: string): Promise<Record<string, unknown>[]> {
  const url = new URL(`https://www.datos.gov.co/resource/${DATASET}.json`);
  url.searchParams.set('expedientecum', expediente);
  url.searchParams.set('$limit', '500');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`INVIMA ${res.status}`);
  return res.json() as Promise<Record<string, unknown>[]>;
}

async function main() {
  const pending = await prisma.codigoCum.findMany({
    where: { OR: [{ descripcionProducto: null }, { descripcionProducto: '' }] },
    select: { id: true, codigoCompleto: true, expedienteCum: true, consecutivo: true, medicamentoId: true },
    take: BATCH,
  });

  if (!pending.length) {
    console.log('✓ No hay CUMs pendientes de descripción.');
    return;
  }

  const byExpediente = new Map<string, typeof pending>();
  for (const row of pending) {
    const list = byExpediente.get(row.expedienteCum) ?? [];
    list.push(row);
    byExpediente.set(row.expedienteCum, list);
  }

  let updated = 0;
  let errors = 0;
  for (const [expediente, rows] of byExpediente) {
    let invimaRows: Record<string, unknown>[];
    try {
      invimaRows = await fetchInvimaByExpediente(expediente);
    } catch (err) {
      console.warn(`  ${expediente}: error INVIMA — ${err instanceof Error ? err.message : err}`);
      errors += rows.length;
      continue;
    }
    const byConsec = new Map(
      invimaRows.map((r) => [
        pickField(r, 'consecutivocum', 'consecutivo_cum') ?? '',
        r,
      ]),
    );

    for (const cum of rows) {
      const raw = byConsec.get(cum.consecutivo);
      if (!raw) continue;

      try {
        const desc = truncate(
          pickField(raw, 'descripcioncomercial', 'descripcion_comercial') ??
            pickField(raw, 'producto'),
          MAX_DESCRIPCION,
        );
        const cantidadStr = pickField(raw, 'cantidadcum', 'cantidad_cum');
        const forma = pickField(raw, 'formafarmaceutica', 'forma_farmaceutica');
        const cantidad = cantidadStr ? parseFloat(cantidadStr.replace(',', '.')) : undefined;

        await prisma.codigoCum.update({
          where: { id: cum.id },
          data: { descripcionProducto: desc },
        });

        const existingPres = await prisma.presentacion.findFirst({
          where: { medicamentoId: cum.medicamentoId, codigoCum: cum.codigoCompleto },
        });
        const presData = {
          descripcion: desc ?? '',
          cantidad,
          unidad: truncate(forma, MAX_UNIDAD) ?? undefined,
        };
        if (existingPres) {
          await prisma.presentacion.update({ where: { id: existingPres.id }, data: presData });
        } else if (desc) {
          await prisma.presentacion.create({
            data: { medicamentoId: cum.medicamentoId, codigoCum: cum.codigoCompleto, ...presData },
          });
        }
        updated++;
      } catch (err) {
        errors++;
        console.warn(
          `  ${cum.codigoCompleto}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    console.log(`  ${expediente}: ${rows.length} CUMs procesados`);
  }

  const remaining = await prisma.codigoCum.count({
    where: { OR: [{ descripcionProducto: null }, { descripcionProducto: '' }] },
  });
  console.log(`\n✓ Actualizados: ${updated}. Errores: ${errors}. Pendientes: ${remaining}`);
  if (remaining > 0) {
    console.log('  Ejecuta de nuevo o corre: pnpm sync:invima');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
