import { api } from './api';
import {
  cacheSearch,
  getCachedSearch,
  getOfflineMedicamento,
  getOfflineStatus,
  saveOfflinePack,
  searchOfflinePack,
} from '@/storage/search-cache';
import { isOnline } from '@/utils/network';
import {
  buildPresentaciones,
  mapMedicamentoSummary,
  type MedicamentoSummary,
  type MedicamentoSuggest,
  type PaginatedMeta,
  type PresentacionesResponse,
} from '@/types';

let syncInFlight: Promise<number> | null = null;

export async function searchMedicamentos(
  query: string,
  tipo = 'nombre',
  page = 1,
): Promise<{ items: MedicamentoSummary[]; meta: PaginatedMeta }> {
  const online = await isOnline();

  if (!online) {
    const offline = await searchOfflinePack(query, tipo);
    if (offline.length) {
      return {
        items: offline.map((r) => mapMedicamentoSummary(r as Record<string, unknown>)),
        meta: { total: offline.length, page: 1, limit: offline.length, totalPages: 1 },
      };
    }
    const cached = await getCachedSearch(`${tipo}:${query}`);
    if (cached) {
      return {
        items: cached.map((r) => mapMedicamentoSummary(r as Record<string, unknown>)),
        meta: { total: cached.length, page: 1, limit: 20, totalPages: 1 },
      };
    }
    throw new Error(
      'Sin conexión y sin paquete offline. Conéctate al servidor y sincroniza desde Perfil.',
    );
  }

  try {
    const { data } = await api.get('/medicamentos/search', {
      params: { q: query, tipo, page, limit: 20 },
    });

    const payload = data.data as { items: Record<string, unknown>[]; meta: PaginatedMeta };
    const items = payload.items.map(mapMedicamentoSummary);

    if (page === 1 && query.trim()) {
      await cacheSearch(`${tipo}:${query}`, payload.items);
    }

    return { items, meta: payload.meta };
  } catch (err) {
    const offline = await searchOfflinePack(query, tipo);
    if (offline.length) {
      return {
        items: offline.map((r) => mapMedicamentoSummary(r as Record<string, unknown>)),
        meta: { total: offline.length, page: 1, limit: offline.length, totalPages: 1 },
      };
    }
    throw err;
  }
}

export async function suggestMedicamentos(
  query: string,
): Promise<{ items: MedicamentoSuggest[]; relacionados: MedicamentoSuggest[] }> {
  const online = await isOnline();
  if (!online) {
    const offline = await searchOfflinePack(query, 'nombre');
    const items = offline.slice(0, 10).map((r) => mapMedicamentoSummary(r as Record<string, unknown>));
    return { items, relacionados: [] };
  }

  try {
    const { data } = await api.get('/medicamentos/suggest', {
      params: { q: query, limit: 10 },
    });
    return data.data as { items: MedicamentoSuggest[]; relacionados: MedicamentoSuggest[] };
  } catch {
    const offline = await searchOfflinePack(query, 'nombre');
    const items = offline.slice(0, 10).map((r) => mapMedicamentoSummary(r as Record<string, unknown>));
    return { items, relacionados: [] };
  }
}

function presentacionesFromOffline(raw: Record<string, unknown>): PresentacionesResponse {
  const presentaciones = buildPresentaciones(raw);
  return {
    medicamento: mapMedicamentoSummary(raw),
    presentaciones,
    total: presentaciones.length,
  };
}

export async function getPresentaciones(id: string): Promise<PresentacionesResponse> {
  const online = await isOnline();
  if (online) {
    try {
      const { data } = await api.get(`/medicamentos/${id}/presentaciones`);
      return data.data as PresentacionesResponse;
    } catch {
      /* fallback offline */
    }
  }

  const offline = await getOfflineMedicamento(id);
  if (offline) return presentacionesFromOffline(offline);
  throw new Error('Sin datos locales de este medicamento. Sincroniza el paquete offline.');
}

export async function getMedicamento(id: string): Promise<Record<string, unknown>> {
  const online = await isOnline();
  if (online) {
    try {
      const { data } = await api.get(`/medicamentos/${id}`);
      return data.data as Record<string, unknown>;
    } catch {
      /* fallback offline */
    }
  }

  const offline = await getOfflineMedicamento(id);
  if (offline) return offline;
  throw new Error('Sin datos locales de este medicamento. Sincroniza el paquete offline.');
}

export async function listFavoritos(): Promise<Record<string, unknown>[]> {
  const { data } = await api.get('/favoritos');
  const payload = data.data as { items: Record<string, unknown>[] };
  return payload.items;
}

export async function addFavorito(entidadTipo: string, entidadId: string): Promise<void> {
  await api.post('/favoritos', { entidadTipo, entidadId });
}

export async function removeFavorito(id: string): Promise<void> {
  await api.delete(`/favoritos/${id}`);
}

export async function syncOfflinePack(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const limit = 300;
    let page = 1;
    let totalPages = 1;
    let total = 0;
    const allItems: Record<string, unknown>[] = [];

    do {
      const { data } = await api.get('/medicamentos/offline-pack', {
        params: { page, limit },
        timeout: 120_000,
      });
      const payload = data.data as {
        items: Record<string, unknown>[];
        meta: { total: number; page: number; limit: number; pages: number };
      };
      allItems.push(...payload.items);
      total = payload.meta.total;
      totalPages = payload.meta.pages ?? Math.max(1, Math.ceil(total / limit));
      onProgress?.(Math.min(allItems.length, total), total || allItems.length);
      page += 1;
    } while (page <= totalPages);

    await saveOfflinePack(allItems);
    return allItems.length;
  })();

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

/** Descarga el paquete si no hay datos o tienen más de maxAgeHours. */
export async function syncOfflinePackIfNeeded(maxAgeHours = 24): Promise<{
  synced: boolean;
  count: number;
  reason: 'fresh' | 'empty' | 'stale' | 'offline' | 'error';
}> {
  const online = await isOnline();
  if (!online) {
    const status = await getOfflineStatus();
    return { synced: false, count: status.count, reason: 'offline' };
  }

  const status = await getOfflineStatus(maxAgeHours);
  if (status.count > 0 && !status.stale) {
    return { synced: false, count: status.count, reason: 'fresh' };
  }

  try {
    const count = await syncOfflinePack();
    return {
      synced: true,
      count,
      reason: status.count === 0 ? 'empty' : 'stale',
    };
  } catch {
    return { synced: false, count: status.count, reason: 'error' };
  }
}
