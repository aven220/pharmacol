import * as SQLite from 'expo-sqlite';

import { sanitizeForStorage } from '@/utils/sanitize';

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('pharmacol.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS search_cache (
        query TEXT PRIMARY KEY,
        items_json TEXT NOT NULL,
        cached_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS favorites_local (
        id TEXT PRIMARY KEY,
        entidad_tipo TEXT NOT NULL,
        entidad_id TEXT NOT NULL,
        notas TEXT,
        cached_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS offline_pack (
        id TEXT PRIMARY KEY,
        nombre_comercial TEXT,
        numero_registro TEXT,
        cum TEXT,
        laboratorio TEXT,
        estado TEXT,
        payload_json TEXT NOT NULL,
        synced_at TEXT NOT NULL
      );
    `);
  }
  return db;
}

export async function cacheSearch(query: string, items: unknown[]): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'INSERT OR REPLACE INTO search_cache (query, items_json, cached_at) VALUES (?, ?, ?)',
    [query.toLowerCase(), JSON.stringify(sanitizeForStorage(items)), new Date().toISOString()],
  );
}

export async function getCachedSearch(query: string): Promise<unknown[] | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ items_json: string }>(
    'SELECT items_json FROM search_cache WHERE query = ?',
    [query.toLowerCase()],
  );
  if (!row) return null;
  return JSON.parse(row.items_json) as unknown[];
}

export async function clearSearchCache(): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM search_cache');
}

export async function saveOfflinePack(items: Array<Record<string, unknown>>): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync('DELETE FROM offline_pack');
  for (const item of items) {
    const registro = item.registroInvima as { numeroRegistro?: string } | undefined;
    const cum = (item.codigosCum as Array<{ codigoCompleto?: string }> | undefined)?.[0]?.codigoCompleto;
    const lab = (item.laboratorio as { razonSocial?: string } | undefined)?.razonSocial;
    await database.runAsync(
      `INSERT INTO offline_pack (id, nombre_comercial, numero_registro, cum, laboratorio, estado, payload_json, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(item.id),
        String(item.nombreComercial ?? ''),
        registro?.numeroRegistro ?? null,
        cum ?? null,
        lab ?? null,
        String(item.estadoRegistro ?? ''),
        JSON.stringify(sanitizeForStorage(item)),
        now,
      ],
    );
  }
}

export async function searchOfflinePack(query: string): Promise<unknown[]> {
  const database = await getDb();
  const q = `%${query.toLowerCase()}%`;
  const rows = await database.getAllAsync<{ payload_json: string }>(
    `SELECT payload_json FROM offline_pack
     WHERE LOWER(nombre_comercial) LIKE ? OR LOWER(numero_registro) LIKE ? OR LOWER(cum) LIKE ?`,
    [q, q, q],
  );
  return rows.map((r) => JSON.parse(r.payload_json));
}

export async function getOfflinePackCount(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM offline_pack');
  return row?.c ?? 0;
}
