import type { DatabaseSync } from 'node:sqlite';

export function migrateSourceFormats(db: DatabaseSync) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE name='sources'").get();
  if (!table || String(table.sql).includes("'mpd'")) return;
  db.exec('BEGIN');
  try {
    db.exec(`CREATE TABLE sources_adaptive_migration(id TEXT PRIMARY KEY, content_id TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('movie','series')), episode_id TEXT NOT NULL DEFAULT '', url TEXT NOT NULL, name TEXT NOT NULL, format TEXT NOT NULL CHECK(format IN ('mp4','webm','m3u8','mpd')), provenance TEXT NOT NULL, created_at TEXT NOT NULL);
      INSERT INTO sources_adaptive_migration SELECT * FROM sources;
      DROP TABLE sources;
      ALTER TABLE sources_adaptive_migration RENAME TO sources;
      CREATE INDEX source_content ON sources(type,content_id,episode_id);
      INSERT OR IGNORE INTO migrations VALUES(2, datetime('now'));
      COMMIT;`);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
