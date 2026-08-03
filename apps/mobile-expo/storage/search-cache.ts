import * as SQLite from 'expo-sqlite';
import { sanitizeForStorage } from '@/utils/sanitize';

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('pharmacol.db');
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
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
      CREATE TABLE IF NOT EXISTS offline_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const schemaVersion = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM offline_meta WHERE key = 'schema_version'",
    );
    if (schemaVersion?.value !== '2') {
      await db.execAsync(`
        DROP TABLE IF EXISTS offline_pack;
        CREATE TABLE offline_pack (
          id TEXT PRIMARY KEY,
          nombre_comercial TEXT,
          nombre_normalizado TEXT,
          numero_registro TEXT,
          cum TEXT,
          principio_activo TEXT,
          laboratorio TEXT,
          estado TEXT,
          payload_json TEXT NOT NULL,
          synced_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_offline_nombre ON offline_pack(nombre_normalizado);
        CREATE INDEX IF NOT EXISTS idx_offline_registro ON offline_pack(numero_registro);
        CREATE INDEX IF NOT EXISTS idx_offline_cum ON offline_pack(cum);
        CREATE INDEX IF NOT EXISTS idx_offline_pa ON offline_pack(principio_activo);
        INSERT OR REPLACE INTO offline_meta (key, value) VALUES ('schema_version', '2');
      `);
    }
  }
  return db;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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

export async function setOfflineMeta(key: string, value: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'INSERT OR REPLACE INTO offline_meta (key, value) VALUES (?, ?)',
    [key, value],
  );
}

export async function getOfflineMeta(key: string): Promise<string | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM offline_meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function getOfflineSyncedAt(): Promise<string | null> {
  return getOfflineMeta('synced_at');
}

function extractPrincipios(item: Record<string, unknown>): string {
  const pas = (item.principiosActivos as Array<Record<string, unknown>> | undefined) ?? [];
  return pas
    .map((p) => {
      const pa = p.principioActivo as Record<string, unknown> | undefined;
      const nombre = String(pa?.nombreOficial ?? pa?.nombreNormalizado ?? '');
      const rawConc = String(p.concentracion ?? '').trim();
      const conc = rawConc.length > 1 ? rawConc : '';
      return nombre ? (conc ? `${nombre} ${conc}` : nombre) : '';
    })
    .filter(Boolean)
    .join(' · ');
}

function extractCums(item: Record<string, unknown>): string {
  const cum = (item.codigosCum as Array<{ codigoCompleto?: string }> | undefined) ?? [];
  return cum
    .map((c) => c.codigoCompleto)
    .filter(Boolean)
    .join(' ');
}

export async function saveOfflinePack(items: Array<Record<string, unknown>>): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();

  await database.execAsync('BEGIN TRANSACTION');
  try {
    await database.runAsync('DELETE FROM offline_pack');
    for (const item of items) {
      const registro = item.registroInvima as { numeroRegistro?: string } | undefined;
      const lab = (item.laboratorio as { razonSocial?: string } | undefined)?.razonSocial;
      const nombre = String(item.nombreComercial ?? '');
      await database.runAsync(
        `INSERT INTO offline_pack (
          id, nombre_comercial, nombre_normalizado, numero_registro, cum,
          principio_activo, laboratorio, estado, payload_json, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(item.id),
          nombre,
          normalize(nombre),
          registro?.numeroRegistro ?? null,
          extractCums(item) || null,
          extractPrincipios(item) || null,
          lab ?? null,
          String(item.estadoRegistro ?? ''),
          JSON.stringify(sanitizeForStorage(item)),
          now,
        ],
      );
    }
    await database.runAsync(
      'INSERT OR REPLACE INTO offline_meta (key, value) VALUES (?, ?)',
      ['synced_at', now],
    );
    await database.runAsync(
      'INSERT OR REPLACE INTO offline_meta (key, value) VALUES (?, ?)',
      ['count', String(items.length)],
    );
    await database.execAsync('COMMIT');
  } catch (err) {
    await database.execAsync('ROLLBACK');
    throw err;
  }
}

export async function searchOfflinePack(
  query: string,
  tipo: string = 'nombre',
  limit = 50,
): Promise<unknown[]> {
  const database = await getDb();
  const q = `%${normalize(query)}%`;
  const rawQ = `%${query.toLowerCase()}%`;

  let sql = `
    SELECT payload_json FROM offline_pack
    WHERE LOWER(nombre_comercial) LIKE ?
       OR nombre_normalizado LIKE ?
       OR LOWER(IFNULL(numero_registro,'')) LIKE ?
       OR LOWER(IFNULL(cum,'')) LIKE ?
       OR LOWER(IFNULL(principio_activo,'')) LIKE ?
    LIMIT ?
  `;
  let params: (string | number)[] = [rawQ, q, rawQ, rawQ, rawQ, limit];

  if (tipo === 'registro') {
    sql = `SELECT payload_json FROM offline_pack WHERE LOWER(IFNULL(numero_registro,'')) LIKE ? LIMIT ?`;
    params = [rawQ, limit];
  } else if (tipo === 'cum') {
    sql = `SELECT payload_json FROM offline_pack WHERE LOWER(IFNULL(cum,'')) LIKE ? LIMIT ?`;
    params = [rawQ, limit];
  } else if (tipo === 'principio_activo') {
    sql = `SELECT payload_json FROM offline_pack
           WHERE LOWER(IFNULL(principio_activo,'')) LIKE ?
              OR nombre_normalizado LIKE ?
           LIMIT ?`;
    params = [rawQ, q, limit];
  }

  const rows = await database.getAllAsync<{ payload_json: string }>(sql, params);
  return rows.map((r) => JSON.parse(r.payload_json));
}

export async function getOfflineMedicamento(id: string): Promise<Record<string, unknown> | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ payload_json: string }>(
    'SELECT payload_json FROM offline_pack WHERE id = ?',
    [id],
  );
  if (!row) return null;
  return JSON.parse(row.payload_json) as Record<string, unknown>;
}

export async function getOfflinePackCount(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM offline_pack');
  return row?.c ?? 0;
}

export async function getOfflineStatus(maxAgeHours = 24): Promise<{
  count: number;
  syncedAt: string | null;
  stale: boolean;
}> {
  const count = await getOfflinePackCount();
  const syncedAt = await getOfflineSyncedAt();
  let stale = true;
  if (syncedAt) {
    const ageMs = Date.now() - new Date(syncedAt).getTime();
    stale = Number.isNaN(ageMs) || ageMs > maxAgeHours * 60 * 60 * 1000;
  }
  return { count, syncedAt, stale };
}
