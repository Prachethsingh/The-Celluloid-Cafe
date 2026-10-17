import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { repositoryRoot } from './repository.js';
import { cleanCatalogItem } from './catalogQuality.js';
import { migrateSourceFormats } from './sourceMigration.js';
import { safeMediaUrl } from './sources.js';

let database: DatabaseSync | undefined;
export function getDatabase(): DatabaseSync {
  if (database) return database;
  const testing = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('.test-build'));
  const filename = process.env.DATABASE_PATH ? path.resolve(repositoryRoot, process.env.DATABASE_PATH) : (testing ? ':memory:' : path.join(repositoryRoot, process.env.E2E_SERVER_TOKEN ? `.build/e2e/platform-${process.env.E2E_SERVER_TOKEN}.sqlite` : 'data/platform.sqlite'));
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','admin')), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS library(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('watchlist','progress')), content_id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,kind,content_id));
    CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, content_id TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('movie','series')), episode_id TEXT NOT NULL DEFAULT '', url TEXT NOT NULL, name TEXT NOT NULL, format TEXT NOT NULL CHECK(format IN ('mp4','webm','m3u8','mpd')), provenance TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS source_content ON sources(type,content_id,episode_id);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, resource TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL, result TEXT, started_at TEXT NOT NULL, finished_at TEXT);
    INSERT OR IGNORE INTO migrations VALUES(1, datetime('now'));
  `);
  migrateSourceFormats(db);
  removeDemoCatalogData(db);
  const insert = db.prepare('INSERT OR IGNORE INTO media(id,type,title,data) VALUES(?,?,?,?)');
  db.exec('BEGIN');
  try {
    const generated = path.join(repositoryRoot, '.build/catalog/catalog.json');
    const seed = fs.existsSync(generated) ? JSON.parse(fs.readFileSync(generated, 'utf8')) : [];
    for (const item of seed) insert.run(item.id, item.type, item.title, JSON.stringify(cleanCatalogItem(item)));
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }

  const sourceInsert = db.prepare('INSERT OR IGNORE INTO sources(id, content_id, type, episode_id, url, name, format, provenance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const seededSources = db.prepare('SELECT COUNT(*) count FROM sources').get() as { count: number };
  if (seededSources.count === 0) {
    const generated = path.join(repositoryRoot, '.build/catalog/catalog.json');
    const seed = fs.existsSync(generated) ? JSON.parse(fs.readFileSync(generated, 'utf8')) : [];
    for (const item of seed) {
      const candidates = [item.stream_url, item.stream_url_webm, item.media_url].filter((value): value is string => typeof value === 'string' && value.length > 0);
      for (const url of candidates) {
        if (!safeMediaUrl(url)) continue;
        const format = url.endsWith('.mpd') ? 'mpd' : url.endsWith('.m3u8') ? 'm3u8' : url.endsWith('.webm') ? 'webm' : 'mp4';
        sourceInsert.run(randomUUID(), item.id, item.type, '', url, item.title, format, 'catalog-seed', new Date().toISOString());
      }
    }
  }

  database = db;
  return db;
}

export function catalogItems(): any[] {
  return getDatabase().prepare('SELECT data FROM media ORDER BY id').all().map(row => cleanCatalogItem(JSON.parse(String(row.data))));
}

export function removeDemoCatalogData(db: DatabaseSync) {
  const removedSources = db.prepare(`DELETE FROM sources
    WHERE content_id IN (SELECT id FROM media WHERE json_extract(data, '$.metadata_provenance') = 'demo-seed')
       OR url IN ('/media/oceans.mp4', 'https://vjs.zencdn.net/v/oceans.mp4')`).run().changes;
  const removedTitles = db.prepare("DELETE FROM media WHERE json_extract(data, '$.metadata_provenance') = 'demo-seed'").run().changes;
  return { removedSources, removedTitles };
}

export function closeDatabase() { database?.close(); database = undefined; }
