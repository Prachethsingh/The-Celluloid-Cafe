import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getDatabase } from './database.js';
import { getVegaCatalog } from './vegaProvider.js';

export class CatalogSyncInProgressError extends Error {
  constructor() {
    super('A catalog synchronization is already running');
    this.name = 'CatalogSyncInProgressError';
  }
}

let activeSync: Promise<{ id: string; synced_records: number; duration_seconds: number }> | undefined;

export function syncCatalogRecords(db: DatabaseSync, records: any[]) {
  const uniqueRecords = new Map<string, any>();
  for (const item of records) {
    if (!item || typeof item.id !== 'string' || !/^tt\d{7,10}$/.test(item.id) || !['movie', 'series'].includes(item.type) || typeof item.title !== 'string' || !item.title.trim()) continue;
    uniqueRecords.set(item.id, item);
  }
  if (uniqueRecords.size === 0) throw new Error('Catalog source returned no valid title records');

  db.exec('BEGIN');
  try {
    const select = db.prepare('SELECT data FROM media WHERE id=?');
    const upsert = db.prepare('INSERT INTO media(id,type,title,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,title=excluded.title,data=excluded.data');
    for (const item of uniqueRecords.values()) {
      const existing = select.get(item.id) as { data: string } | undefined;
      const current = existing ? JSON.parse(existing.data) : {};
      const merged = { ...current, ...item };
      if (item.poster_url == null) merged.poster_url = current.poster_url || null;
      if (item.backdrop_url == null) merged.backdrop_url = current.backdrop_url || null;
      if (item.availability_provenance === 'unverified' && current.availability_verified) {
        merged.availability = current.availability || {};
        merged.availability_verified = true;
        merged.availability_provenance = current.availability_provenance;
      }
      upsert.run(item.id, item.type, item.title, JSON.stringify(merged));
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return uniqueRecords.size;
}

export function synchronizeLiveCatalog() {
  if (activeSync) throw new CatalogSyncInProgressError();
  const db = getDatabase();
  if (db.prepare("SELECT id FROM jobs WHERE kind='catalog-sync' AND status='running'").get()) throw new CatalogSyncInProgressError();

  const id = randomUUID();
  const startedAt = Date.now();
  db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?)').run(id, 'catalog-sync', 'running', null, new Date().toISOString(), null);
  const operation = (async () => {
    try {
      const categories = await Promise.all([
        getVegaCatalog('top_movies'),
        getVegaCatalog('top_series'),
        getVegaCatalog('featured_movies'),
        getVegaCatalog('featured_series')
      ]);
      const syncedRecords = syncCatalogRecords(db, categories.flat());
      const durationSeconds = (Date.now() - startedAt) / 1000;
      db.prepare('UPDATE jobs SET status=?,result=?,finished_at=? WHERE id=?').run('completed', JSON.stringify({ synced_records: syncedRecords }), new Date().toISOString(), id);
      return { id, synced_records: syncedRecords, duration_seconds: durationSeconds };
    } catch (error) {
      db.prepare('UPDATE jobs SET status=?,result=?,finished_at=? WHERE id=?').run('failed', JSON.stringify({ error: 'Upstream catalog unavailable' }), new Date().toISOString(), id);
      console.error('Catalog synchronization failed:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  })();
  activeSync = operation;
  return operation.finally(() => { activeSync = undefined; });
}

export function startCatalogSyncSchedule() {
  const db = getDatabase();
  db.prepare("UPDATE jobs SET status='failed',result=?,finished_at=? WHERE kind='catalog-sync' AND status='running'")
    .run(JSON.stringify({ error: 'Interrupted by process restart' }), new Date().toISOString());

  if (process.env.VEGA_OFFLINE === 'true') {
    console.info('Catalog auto-sync disabled because VEGA_OFFLINE=true');
    return undefined;
  }

  const configuredInterval = Number(process.env.CATALOG_SYNC_INTERVAL_MS || 15 * 60 * 1000);
  const interval = Number.isFinite(configuredInterval) && configuredInterval >= 60_000 ? configuredInterval : 15 * 60 * 1000;
  void synchronizeLiveCatalog().catch(() => {});
  const timer = setInterval(() => { void synchronizeLiveCatalog().catch(() => {}); }, interval);
  timer.unref();
  return timer;
}
