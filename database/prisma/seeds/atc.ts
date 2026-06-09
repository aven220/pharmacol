import type { PrismaClient } from '@prisma/client';

/**
 * Seed ATC WHO — Niveles 1-3 (muestra representativa).
 * El seed completo (~7000 códigos) se importa vía CSV en producción.
 * Fuente: WHO ATC/DDD Index (estructura jerárquica).
 */
export const ATC_SEED: Array<{
  codigo: string;
  nivel: number;
  descripcion: string;
  padreCodigo: string | null;
}> = [
  // Nivel 1 — Grupos anatómicos principales
  { codigo: 'A', nivel: 1, descripcion: 'Tracto alimentario y metabolismo', padreCodigo: null },
  { codigo: 'B', nivel: 1, descripcion: 'Sangre y órganos hematopoyéticos', padreCodigo: null },
  { codigo: 'C', nivel: 1, descripcion: 'Sistema cardiovascular', padreCodigo: null },
  { codigo: 'D', nivel: 1, descripcion: 'Dermatológicos', padreCodigo: null },
  { codigo: 'G', nivel: 1, descripcion: 'Sistema genitourinario y hormonas sexuales', padreCodigo: null },
  { codigo: 'H', nivel: 1, descripcion: 'Preparaciones hormonales sistémicas', padreCodigo: null },
  { codigo: 'J', nivel: 1, descripcion: 'Antiinfecciosos para uso sistémico', padreCodigo: null },
  { codigo: 'L', nivel: 1, descripcion: 'Antineoplásicos e inmunomoduladores', padreCodigo: null },
  { codigo: 'M', nivel: 1, descripcion: 'Sistema musculoesquelético', padreCodigo: null },
  { codigo: 'N', nivel: 1, descripcion: 'Sistema nervioso', padreCodigo: null },
  { codigo: 'P', nivel: 1, descripcion: 'Productos antiparasitarios', padreCodigo: null },
  { codigo: 'R', nivel: 1, descripcion: 'Sistema respiratorio', padreCodigo: null },
  { codigo: 'S', nivel: 1, descripcion: 'Órganos de los sentidos', padreCodigo: null },
  { codigo: 'V', nivel: 1, descripcion: 'Varios', padreCodigo: null },

  // Nivel 2 — Subgrupos (muestra representativa)
  { codigo: 'A02', nivel: 2, descripcion: 'Fármacos para trastornos ácido-pépticos', padreCodigo: 'A' },
  { codigo: 'A10', nivel: 2, descripcion: 'Fármacos usados en diabetes', padreCodigo: 'A' },
  { codigo: 'C09', nivel: 2, descripcion: 'Agentes que actúan sobre el sistema renina-angiotensina', padreCodigo: 'C' },
  { codigo: 'C10', nivel: 2, descripcion: 'Agentes modificadores de lípidos', padreCodigo: 'C' },
  { codigo: 'J01', nivel: 2, descripcion: 'Antibacterianos para uso sistémico', padreCodigo: 'J' },
  { codigo: 'M01', nivel: 2, descripcion: 'Productos antiinflamatorios y antirreumáticos', padreCodigo: 'M' },
  { codigo: 'N02', nivel: 2, descripcion: 'Analgésicos', padreCodigo: 'N' },
  { codigo: 'N05', nivel: 2, descripcion: 'Psicolepticos', padreCodigo: 'N' },
  { codigo: 'N06', nivel: 2, descripcion: 'Psicoanalépticos', padreCodigo: 'N' },
  { codigo: 'R03', nivel: 2, descripcion: 'Fármacos para enfermedades obstructivas de vías respiratorias', padreCodigo: 'R' },
  { codigo: 'R06', nivel: 2, descripcion: 'Antihistamínicos para uso sistémico', padreCodigo: 'R' },

  // Nivel 3 — Sub-subgrupos farmacológicos
  { codigo: 'A02B', nivel: 3, descripcion: 'Fármacos para úlcera péptica y reflujo gastroesofágico', padreCodigo: 'A02' },
  { codigo: 'A10B', nivel: 3, descripcion: 'Hipoglucemiantes orales', padreCodigo: 'A10' },
  { codigo: 'C09A', nivel: 3, descripcion: 'Inhibidores de la ECA, planos', padreCodigo: 'C09' },
  { codigo: 'C09C', nivel: 3, descripcion: 'Antagonistas de angiotensina II, planos', padreCodigo: 'C09' },
  { codigo: 'C10A', nivel: 3, descripcion: 'Hipolipemiantes, planos', padreCodigo: 'C10' },
  { codigo: 'J01C', nivel: 3, descripcion: 'Antibacterianos beta-lactámicos, penicilinas', padreCodigo: 'J01' },
  { codigo: 'J01D', nivel: 3, descripcion: 'Antibacterianos beta-lactámicos, cefalosporinas', padreCodigo: 'J01' },
  { codigo: 'J01F', nivel: 3, descripcion: 'Antibacterianos macrólidos, lincosamidas y estreptograminas', padreCodigo: 'J01' },
  { codigo: 'M01A', nivel: 3, descripcion: 'Productos antiinflamatorios y antirreumáticos no esteroideos', padreCodigo: 'M01' },
  { codigo: 'N02B', nivel: 3, descripcion: 'Otros analgésicos y antipiréticos', padreCodigo: 'N02' },
  { codigo: 'N05B', nivel: 3, descripcion: 'Ansiolíticos', padreCodigo: 'N05' },
  { codigo: 'N06A', nivel: 3, descripcion: 'Antidepresivos', padreCodigo: 'N06' },
  { codigo: 'R03A', nivel: 3, descripcion: 'Adrenérgicos inhalados', padreCodigo: 'R03' },
  { codigo: 'R03B', nivel: 3, descripcion: 'Otros fármacos para enfermedades obstructivas, inhalados', padreCodigo: 'R03' },
  { codigo: 'R06A', nivel: 3, descripcion: 'Antihistamínicos para uso sistémico', padreCodigo: 'R06' },

  // Nivel 4 — Subgrupos químicos (muestra)
  { codigo: 'A02BC', nivel: 4, descripcion: 'Inhibidores de la bomba de protones', padreCodigo: 'A02B' },
  { codigo: 'C09AA', nivel: 4, descripcion: 'Inhibidores de la ECA, planos', padreCodigo: 'C09A' },
  { codigo: 'C09CA', nivel: 4, descripcion: 'Antagonistas de angiotensina II, planos', padreCodigo: 'C09C' },
  { codigo: 'C10AA', nivel: 4, descripcion: 'Inhibidores de HMG CoA reductasa', padreCodigo: 'C10A' },
  { codigo: 'J01CA', nivel: 4, descripcion: 'Penicilinas con espectro extendido', padreCodigo: 'J01C' },
  { codigo: 'J01FA', nivel: 4, descripcion: 'Macrólidos', padreCodigo: 'J01F' },
  { codigo: 'M01AE', nivel: 4, descripcion: 'Derivados del ácido propiónico', padreCodigo: 'M01A' },
  { codigo: 'N02BE', nivel: 4, descripcion: 'Anilidas', padreCodigo: 'N02B' },
  { codigo: 'N05BA', nivel: 4, descripcion: 'Derivados de benzodiazepina', padreCodigo: 'N05B' },
  { codigo: 'N06AB', nivel: 4, descripcion: 'Inhibidores selectivos de la recaptación de serotonina', padreCodigo: 'N06A' },
  { codigo: 'R06AE', nivel: 4, descripcion: 'Derivados de piperazina', padreCodigo: 'R06A' },

  // Nivel 5 — Sustancias químicas (muestra común en Colombia)
  { codigo: 'A02BC01', nivel: 5, descripcion: 'omeprazol', padreCodigo: 'A02BC' },
  { codigo: 'A02BC02', nivel: 5, descripcion: 'pantoprazol', padreCodigo: 'A02BC' },
  { codigo: 'A02BC03', nivel: 5, descripcion: 'lansoprazol', padreCodigo: 'A02BC' },
  { codigo: 'C09AA02', nivel: 5, descripcion: 'enalapril', padreCodigo: 'C09AA' },
  { codigo: 'C09AA05', nivel: 5, descripcion: 'ramipril', padreCodigo: 'C09AA' },
  { codigo: 'C09CA01', nivel: 5, descripcion: 'losartán', padreCodigo: 'C09CA' },
  { codigo: 'C09CA03', nivel: 5, descripcion: 'valsartán', padreCodigo: 'C09CA' },
  { codigo: 'C10AA01', nivel: 5, descripcion: 'simvastatina', padreCodigo: 'C10AA' },
  { codigo: 'C10AA05', nivel: 5, descripcion: 'atorvastatina', padreCodigo: 'C10AA' },
  { codigo: 'J01CA04', nivel: 5, descripcion: 'amoxicilina', padreCodigo: 'J01CA' },
  { codigo: 'J01FA09', nivel: 5, descripcion: 'azitromicina', padreCodigo: 'J01FA' },
  { codigo: 'J01FA10', nivel: 5, descripcion: 'claritromicina', padreCodigo: 'J01FA' },
  { codigo: 'M01AE01', nivel: 5, descripcion: 'ibuprofeno', padreCodigo: 'M01AE' },
  { codigo: 'M01AE51', nivel: 5, descripcion: 'ibuprofeno, combinaciones', padreCodigo: 'M01AE' },
  { codigo: 'N02BE01', nivel: 5, descripcion: 'paracetamol', padreCodigo: 'N02BE' },
  { codigo: 'N05BA01', nivel: 5, descripcion: 'diazepam', padreCodigo: 'N05BA' },
  { codigo: 'N05BA06', nivel: 5, descripcion: 'lorazepam', padreCodigo: 'N05BA' },
  { codigo: 'N06AB03', nivel: 5, descripcion: 'fluoxetina', padreCodigo: 'N06AB' },
  { codigo: 'N06AB06', nivel: 5, descripcion: 'sertralina', padreCodigo: 'N06AB' },
  { codigo: 'R06AE07', nivel: 5, descripcion: 'cetirizina', padreCodigo: 'R06AE' },
  { codigo: 'R06AE09', nivel: 5, descripcion: 'levocetirizina', padreCodigo: 'R06AE' },
];

export async function seedAtcCodes(prisma: PrismaClient): Promise<void> {
  console.log('  → Códigos ATC...');

  // Insertar en orden de nivel para respetar FK padre
  const sorted = [...ATC_SEED].sort((a, b) => a.nivel - b.nivel);

  for (const atc of sorted) {
    await prisma.atcCode.upsert({
      where: { codigo: atc.codigo },
      update: { descripcion: atc.descripcion, nivel: atc.nivel, padreCodigo: atc.padreCodigo },
      create: {
        codigo: atc.codigo,
        nivel: atc.nivel,
        descripcion: atc.descripcion,
        padreCodigo: atc.padreCodigo,
      },
    });
  }
}
