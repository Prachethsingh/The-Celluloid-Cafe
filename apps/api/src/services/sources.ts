import { getDatabase } from './database.js';

export function safeMediaUrl(value: string): boolean {
  if (/^\/media\/[A-Za-z0-9_-]+\.(mp4|webm|m3u8|mpd)$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[|.*\.local$)/i.test(url.hostname);
  } catch { return false; }
}

export function storedSources(type: string, id: string, episodeId = '') {
  return getDatabase().prepare('SELECT * FROM sources WHERE type=? AND content_id=? AND episode_id=? ORDER BY created_at DESC').all(type, id, episodeId).map(row => ({
    id: String(row.id), provider: 'catalog', content_id: String(row.content_id), episode_id: String(row.episode_id),
    url: String(row.url), name: String(row.name), server: String(row.name), format: String(row.format), type: 'direct',
    provenance: String(row.provenance), subtitles: [],
  }));
}
