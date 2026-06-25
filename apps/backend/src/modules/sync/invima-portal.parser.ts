export interface InvimaPortalCategory {
  slug: string;
  codigo: string;
  nombre: string;
}

/** Categorías del portal INVIMA — app.invima.gov.co/alertas */
export const INVIMA_PORTAL_CATEGORIES: InvimaPortalCategory[] = [
  { slug: 'medicamentos-productos-biologicos', codigo: 'medicamentos', nombre: 'Medicamentos y biológicos' },
  { slug: 'alertas-alimentos-bebidas', codigo: 'alimentos', nombre: 'Alimentos y bebidas' },
  {
    slug: 'cosmeticos-aseo-plaguicidas-productos-higiene',
    codigo: 'cosmeticos',
    nombre: 'Cosméticos, aseo y plaguicidas',
  },
  { slug: 'dispositivos-medicos-invima', codigo: 'dispositivos', nombre: 'Dispositivos médicos' },
  { slug: 'alertas-sanitarias-general', codigo: 'general', nombre: 'Todas las categorías' },
];

export interface InvimaPortalAlerta {
  categoriaProducto: string;
  titulo: string;
  tipoDocumento: string;
  fecha: string;
  documentoUrl: string;
  numeroAlerta: string;
}

const PORTAL_BASE = 'https://app.invima.gov.co/alertas';

export function buildInvimaPortalPageUrl(slug: string, page: number): string {
  const base = `${PORTAL_BASE}/${slug}`;
  return page <= 0 ? base : `${base}?page=${page}`;
}

export function extractNumeroAlertaFromPdfUrl(url: string): string | null {
  try {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/Alerta\s*No[_#.\s%]*(\d+-\d{4})/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function fieldContent(rowHtml: string, fieldName: string): string {
  const re = new RegExp(
    `views-field-${fieldName}[\\s\\S]*?field-content[^>]*>([\\s\\S]*?)</(?:div|span)>`,
    'i',
  );
  const match = rowHtml.match(re);
  return match ? stripHtml(match[1]) : '';
}

function pdfUrl(rowHtml: string): string | null {
  const match = rowHtml.match(/href="([^"]*ckfinder\/userfiles[^"]+\.pdf[^"]*)"/i);
  if (!match) return null;
  const href = match[1];
  if (href.startsWith('http')) return href;
  return `${PORTAL_BASE}${href.startsWith('/') ? '' : '/'}${href}`.replace('/alertas/alertas/', '/alertas/');
}

/** Parsea filas de alertas en HTML de Drupal Views del portal INVIMA. */
export function parseInvimaPortalHtml(html: string, categoriaProducto: string): InvimaPortalAlerta[] {
  const items: InvimaPortalAlerta[] = [];
  const chunks = html.split(/<div class="views-row views-row-/i).slice(1);

  for (const chunk of chunks) {
    if (!chunk.includes('ckfinder/userfiles')) continue;

    const rowHtml = `<div class="views-row views-row-${chunk}`;
    const documentoUrl = pdfUrl(rowHtml);
    if (!documentoUrl) continue;

    const numeroAlerta = extractNumeroAlertaFromPdfUrl(documentoUrl);
    if (!numeroAlerta) continue;

    const titulo = fieldContent(rowHtml, 'title') || fieldContent(rowHtml, 'name');
    const fecha =
      fieldContent(rowHtml, 'field-a-o') ||
      fieldContent(rowHtml, 'field-fecha') ||
      '';
    if (!titulo || !/^\d{4}-\d{2}-\d{2}/.test(fecha)) continue;

    items.push({
      categoriaProducto,
      titulo,
      tipoDocumento: fieldContent(rowHtml, 'field-tipo-de-documento') || 'Alerta sanitaria',
      fecha: fecha.slice(0, 10),
      documentoUrl,
      numeroAlerta,
    });
  }

  return items;
}
