import { api } from './api';
import { cacheSearch, getCachedSearch, saveOfflinePack, searchOfflinePack } from '@/storage/search-cache';
import { isOnline } from '@/utils/network';
import { mapMedicamentoSummary, type MedicamentoSummary, type MedicamentoSuggest, type PaginatedMeta, type PresentacionesResponse } from '@/types';

export async function searchMedicamentos(
  query: string,
  tipo = 'nombre',
  page = 1,
): Promise<{ items: MedicamentoSummary[]; meta: PaginatedMeta }> {
  const online = await isOnline();

  if (!online) {
    const cached = await getCachedSearch(query);
    if (cached) {
      return {
        items: cached.map((r) => mapMedicamentoSummary(r as Record<string, unknown>)),
        meta: { total: cached.length, page: 1, limit: 20, totalPages: 1 },
      };
    }
    const offline = await searchOfflinePack(query);
    if (offline.length) {
      return {
        items: offline.map((r) => mapMedicamentoSummary(r as Record<string, unknown>)),
        meta: { total: offline.length, page: 1, limit: 20, totalPages: 1 },
      };
    }
    throw new Error('Sin conexión y sin datos en caché');
  }

  const { data } = await api.get('/medicamentos/search', {
    params: { q: query, tipo, page, limit: 20 },
  });

  const payload = data.data as { items: Record<string, unknown>[]; meta: PaginatedMeta };
  const items = payload.items.map(mapMedicamentoSummary);

  if (page === 1 && query.trim()) {
    await cacheSearch(query, payload.items);
  }

  return { items, meta: payload.meta };
}

export async function suggestMedicamentos(
  query: string,
): Promise<{ items: MedicamentoSuggest[]; relacionados: MedicamentoSuggest[] }> {
  const online = await isOnline();
  if (!online) {
    const offline = await searchOfflinePack(query);
    const items = offline.slice(0, 10).map((r) => mapMedicamentoSummary(r as Record<string, unknown>));
    return { items, relacionados: [] };
  }

  const { data } = await api.get('/medicamentos/suggest', {
    params: { q: query, limit: 10 },
  });
  return data.data as { items: MedicamentoSuggest[]; relacionados: MedicamentoSuggest[] };
}

export async function getPresentaciones(id: string): Promise<PresentacionesResponse> {
  const { data } = await api.get(`/medicamentos/${id}/presentaciones`);
  return data.data as PresentacionesResponse;
}

export async function getMedicamento(id: string): Promise<Record<string, unknown>> {
  const { data } = await api.get(`/medicamentos/${id}`);
  return data.data as Record<string, unknown>;
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

export async function syncOfflinePack(): Promise<number> {
  const limit = 500;
  let page = 1;
  let totalPages = 1;
  const allItems: Record<string, unknown>[] = [];

  do {
    const { data } = await api.get('/medicamentos/offline-pack', { params: { page, limit } });
    const payload = data.data as {
      items: Record<string, unknown>[];
      meta: { total: number; page: number; limit: number; pages: number };
    };
    allItems.push(...payload.items);
    totalPages = payload.meta.pages ?? Math.max(1, Math.ceil(payload.meta.total / limit));
    page += 1;
  } while (page <= totalPages);

  await saveOfflinePack(allItems);
  return allItems.length;
}
