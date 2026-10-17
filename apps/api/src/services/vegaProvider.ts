import { storedSources } from './sources.js';
import { getDatabase } from './database.js';
import fs from 'node:fs';
import path from 'node:path';
import { providerSourceDirectory } from './repository.js';

/**
 * Zenda-Cross Vega-Providers Adapter Service
 * Reference: https://github.com/Zenda-Cross/vega-providers
 * 
 * Provides:
 * 1. Cinemeta live movie/series catalog & metadata
 * 2. Multi-server stream resolution (AutoEmbed, Torrentio, NetMirror, CDN)
 * 3. Provider manifest and metadata discovery from packages/vega-providers
 */

export interface VegaProviderInfo {
  name: string;
  value: string;
  version: string;
  type: string;
  icon: string;
  url?: string;
  hasSettings?: boolean;
  disabled?: boolean;
}

export interface VegaStreamSource {
  server: string;
  name: string;
  quality: string;
  type: 'embed' | 'direct' | 'torrent' | 'hls';
  url: string;
  details?: string;
  headers?: Record<string, string>;
}

export function getVegaManifestAndUrls() {
  const candidateDirs = [providerSourceDirectory];

  let manifestPath = '';
  let urlsPath = '';
  for (const dir of candidateDirs) {
    const m = path.join(dir, 'manifest.json');
    const u = path.join(dir, 'urls.json');
    if (fs.existsSync(m)) {
      manifestPath = m;
      urlsPath = u;
      break;
    }
  }

  let rawManifest: any[] = [];
  let urlsMap: Record<string, { name: string; url: string }> = {};

  if (manifestPath && fs.existsSync(manifestPath)) {
    try {
      rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (_) {}
  }

  if (urlsPath && fs.existsSync(urlsPath)) {
    try {
      urlsMap = JSON.parse(fs.readFileSync(urlsPath, 'utf-8'));
    } catch (_) {}
  }

  return { rawManifest, urlsMap };
}

export function getAllVegaProviders(typeFilter?: string): VegaProviderInfo[] {
  const { rawManifest, urlsMap } = getVegaManifestAndUrls();
  if (!rawManifest || rawManifest.length === 0) {
    return VEGA_PROVIDERS_MANIFEST;
  }

  const list: VegaProviderInfo[] = rawManifest.map(item => {
    const key = item.value || '';
    const name = item.display_name || item.name || key;
    const urlEntry = urlsMap[key] || urlsMap[name] || Object.values(urlsMap).find((v: any) =>
      v?.name?.toLowerCase() === name.toLowerCase() || v?.name?.toLowerCase() === key.toLowerCase()
    );

    return {
      name,
      value: key,
      version: item.version || '1.0',
      type: item.type || 'global',
      icon: item.icon || (key ? `https://cdn.jsdelivr.net/gh/Zenda-Cross/vega-providers@main/assets/${key}.png` : ''),
      url: urlEntry?.url,
      hasSettings: !!item.hasSettings,
      disabled: !!item.disabled
    };
  });

  if (typeFilter && typeFilter !== 'all') {
    return list.filter(p => p.type.toLowerCase() === typeFilter.toLowerCase());
  }

  return list;
}

export const VEGA_PROVIDERS_MANIFEST: VegaProviderInfo[] = [
  {
    name: "NetflixMirror",
    value: "netflixMirror",
    version: "2.11",
    icon: "https://cdn.jsdelivr.net/gh/Zenda-Cross/vega-providers@main/assets/netflixMirror.webp",
    type: "global",
    disabled: false
  },
  {
    name: "PrimeMirror",
    value: "primeMirror",
    version: "2.10",
    icon: "https://cdn.jsdelivr.net/gh/Zenda-Cross/vega-providers@main/assets/primeMirror.webp",
    type: "global",
    disabled: false
  },
  {
    name: "DisneyMirror",
    value: "disneyMirror",
    version: "2.2",
    icon: "https://cdn.jsdelivr.net/gh/Zenda-Cross/vega-providers@main/assets/disneyMirror.webp",
    type: "global",
    disabled: false
  },
  {
    name: "AutoEmbed Multi-Server",
    value: "autoEmbed",
    version: "2.0",
    icon: "https://cdn.jsdelivr.net/gh/Zenda-Cross/vega-providers@main/assets/everything.png",
    type: "global",
    disabled: false
  },
  {
    name: "Torrentio Streams",
    value: "torrentio",
    version: "1.20",
    icon: "https://cdn.jsdelivr.net/gh/Zenda-Cross/vega-providers@main/assets/torrentio.png",
    type: "global",
    disabled: false
  },
  {
    name: "ShowBox Media",
    value: "showbox",
    version: "1.8",
    icon: "https://cdn.jsdelivr.net/gh/Zenda-Cross/vega-providers@main/assets/showbox.png",
    type: "english",
    disabled: false
  },
  {
    name: "HdHub4u",
    value: "hdhub4u",
    version: "2.27",
    icon: "https://cdn.jsdelivr.net/gh/Zenda-Cross/vega-providers@main/assets/hdhub4u.png",
    type: "global",
    disabled: false
  },
  {
    name: "MX Player",
    value: "mxplayer",
    version: "1.0",
    icon: "https://cdn.jsdelivr.net/gh/Zenda-Cross/vega-providers@main/assets/mxplayer.png",
    type: "india",
    disabled: false
  }
];

const CINEMETA_CATALOG_BASE = "https://cinemeta-catalogs.strem.io";
const CINEMETA_META_BASE = "https://v3-cinemeta.strem.io";
const TORRENTIO_BASE = "https://torrentio.strem.fun";
const safeArtworkUrl = (value: unknown) => {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.hostname.endsWith('unsplash.com') ? url.href : null; } catch { return null; }
};

/**
 * Fetch live catalog from Cinemeta (Zenda-Cross vega-providers catalog source)
 */
export async function getVegaCatalog(category: 'top_movies' | 'top_series' | 'featured_movies' | 'featured_series' = 'top_movies') {
  if (process.env.VEGA_OFFLINE === 'true') return [];
  let endpoint = '/top/catalog/movie/top.json';
  if (category === 'top_series') endpoint = '/top/catalog/series/top.json';
  else if (category === 'featured_movies') endpoint = '/imdbRating/catalog/movie/imdbRating.json';
  else if (category === 'featured_series') endpoint = '/imdbRating/catalog/series/imdbRating.json';

  try {
    const res = await fetch(`${CINEMETA_CATALOG_BASE}${endpoint}`, {
      headers: {
        'User-Agent': 'Vega-Platform/1.0 (Unified Streaming)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const metas = Array.isArray(data?.metas) ? data.metas : [];

    return metas.filter((m: any) => m && /^tt\d{7,10}$/.test(m.imdb_id || m.id || '') && typeof m.name === 'string' && m.name.trim() && ['movie', 'series'].includes(m.type)).map((m: any) => ({
      id: m.imdb_id || m.id,
      imdb_id: m.imdb_id || m.id,
      title: m.name,
      type: m.type === 'series' ? 'series' : 'movie',
      year: /^\d{4}/.test(String(m.year || m.releaseInfo || '')) ? Number(String(m.year || m.releaseInfo).slice(0, 4)) : null,
      rating: Number.isFinite(Number(m.imdbRating)) && Number(m.imdbRating) > 0 && Number(m.imdbRating) <= 10 ? Number(m.imdbRating) : null,
      genres: Array.isArray(m.genres) ? m.genres.filter((genre: unknown) => typeof genre === 'string') : [],
      description: typeof m.description === 'string' ? m.description : '',
      poster_url: safeArtworkUrl(m.poster),
      backdrop_url: safeArtworkUrl(m.background),
      metadata_provenance: 'cinemeta', artwork_provenance: 'cinemeta-id-record', rating_provenance: 'cinemeta-imdb',
      availability: {}, availability_verified: false, availability_provenance: 'unverified',
      provider: 'vega-cinemeta',
      source: 'Zenda-Cross/vega-providers'
    }));
  } catch (err: any) {
    console.error('getVegaCatalog error:', err.message);
    return [];
  }
}

/**
 * Fetch detailed metadata + episodes from Cinemeta (Zenda-Cross getCinemetaMeta)
 */
export async function getVegaMetadata(type: 'movie' | 'series', imdbId: string) {
  try {
    const res = await fetch(`${CINEMETA_META_BASE}/meta/${type}/${imdbId}.json`, {
      headers: {
        'User-Agent': 'Vega-Platform/1.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const meta = data?.meta;
    if (!meta || (meta.imdb_id || meta.id) !== imdbId || (meta.type && meta.type !== type) || typeof meta.name !== 'string') return null;

    return {
      id: meta.imdb_id || imdbId,
      imdb_id: meta.imdb_id || imdbId,
      tmdb_id: meta.moviedb_id,
      title: meta.name,
      type: meta.type || type,
      year: /^\d{4}/.test(String(meta.year || meta.releaseInfo || '')) ? Number(String(meta.year || meta.releaseInfo).slice(0, 4)) : null,
      rating: Number.isFinite(Number(meta.imdbRating)) && Number(meta.imdbRating) > 0 && Number(meta.imdbRating) <= 10 ? Number(meta.imdbRating) : null,
      genres: Array.isArray(meta.genres) ? meta.genres : [],
      cast: meta.cast || [],
      overview: meta.description,
      poster_url: safeArtworkUrl(meta.poster),
      backdrop_url: safeArtworkUrl(meta.background),
      logo_url: safeArtworkUrl(meta.logo),
      videos: (Array.isArray(meta.videos) ? meta.videos : []).filter((v: any) => v && typeof v.id === 'string').map((v: any) => ({
        id: v.id,
        name: v.name,
        season: v.season,
        episode: v.episode || v.number,
        overview: v.overview || v.description,
        thumbnail: v.thumbnail,
        released: v.released || v.firstAired
      }))
    };
  } catch (err: any) {
    console.error('getVegaMetadata error:', err.message);
    return null;
  }
}

/**
 * Search Cinemeta catalog (Zenda-Cross search engine)
 */
export async function searchVega(query: string, type: 'movie' | 'series' = 'movie') {
  try {
    const enc = encodeURIComponent(query);
    const res = await fetch(`${CINEMETA_META_BASE}/catalog/${type}/top/search=${enc}.json`, {
      headers: {
        'User-Agent': 'Vega-Platform/1.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.metas || []).map((m: any) => ({
      id: m.imdb_id || m.id,
      imdb_id: m.imdb_id || m.id,
      title: m.name,
      type: m.type || type,
      year: m.year ? parseInt(String(m.year).slice(0, 4), 10) : 2025,
      poster_url: m.poster,
      rating: m.imdbRating ? parseFloat(m.imdbRating) : null
    }));
  } catch (err: any) {
    console.error('searchVega error:', err.message);
    return [];
  }
}

// Explicit title/year identity; the previous speculative mappings for upcoming
// releases and unrelated films are intentionally removed.
const CATALOG_IDENTITIES: Record<string, { year: number; imdbId: string }> = {
  interstellar: { year: 2014, imdbId: 'tt0816692' },
};

export function resolveVegaIdentity(id: string) {
  if (/^tt\d{7,10}$/.test(id)) return id;
  const row = getDatabase().prepare('SELECT data FROM media WHERE id=?').get(id);
  if (!row) return null;
  const item = JSON.parse(String(row.data));
  if (/^tt\d{7,10}$/.test(item.imdb_id || '')) return item.imdb_id;
  const slug = String(item.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const identity = CATALOG_IDENTITIES[slug];
  return identity && Number(item.year) === identity.year ? identity.imdbId : null;
}

export async function resolveVegaStreams(type: 'movie' | 'series', id: string, _season?: number, _episode?: number, _title?: string): Promise<VegaStreamSource[]> {
  return storedSources(type, id).map(source => ({ ...source, type: 'direct' as const, quality: '' }));
}

export const getVegaStreams = resolveVegaStreams;

/**
 * Real-time ping testing for any provider in packages/vega-providers
 */
export async function pingVegaProvider(providerKey: string): Promise<{
  provider: string;
  url: string;
  status: 'online' | 'slow' | 'offline';
  latencyMs: number;
  httpStatus?: number;
}> {
  const { urlsMap } = getVegaManifestAndUrls();
  const entry = urlsMap[providerKey] || Object.values(urlsMap).find((v: any) => v?.name?.toLowerCase() === providerKey.toLowerCase());
  const targetUrl = entry?.url || (providerKey === 'torrentio' ? TORRENTIO_BASE : 'https://v3-cinemeta.strem.io');

  const start = Date.now();
  try {
    const res = await fetch(targetUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000)
    }).catch(() => fetch(targetUrl, { signal: AbortSignal.timeout(3000) }));

    const latencyMs = Date.now() - start;
    return {
      provider: providerKey,
      url: targetUrl,
      status: !res.ok ? 'offline' : latencyMs < 800 ? 'online' : 'slow',
      latencyMs,
      httpStatus: res.status
    };
  } catch (_) {
    return {
      provider: providerKey,
      url: targetUrl,
      status: 'offline',
      latencyMs: Date.now() - start
    };
  }
}

/**
 * Execute targeted scraper from packages/vega-providers for a specific provider
 */
export async function scrapeSpecificVegaProvider(providerKey: string, _type: 'movie' | 'series', _id: string, _season?: number, _episode?: number, _title?: string) {
  return { provider: providerKey, success: false, streams: [], executionTimeMs: 0, error: 'Execute original provider modules through the Vega sandbox; fabricated scraper responses are retired.' };
}

/**
 * Vega App Backup System (matching packages/vega-app/src/lib/backup.ts)
 */
export function createVegaBackupPayload(userData: {
  watchlist?: any[];
  continueWatching?: any[];
  downloads?: any[];
  providerOrder?: string[];
  settings?: any;
}) {
  return {
    version: 1,
    appName: 'Vega-Movie-Platform',
    schema: 'vega-app-v1-backup',
    createdAt: new Date().toISOString(),
    data: {
      watchlist: userData.watchlist || [],
      continueWatching: userData.continueWatching || [],
      downloads: userData.downloads || [],
      providerOrder: userData.providerOrder || [
        'direct', 'torrentio', 'autoEmbed', 'netflixMirror', 'primeMirror', 'drive', 'uhd', '4khdhub'
      ],
      settings: userData.settings || {
        playbackSpeed: 1.0,
        volume: 0.85,
        defaultQuality: '1080p Full HD',
        subtitleLanguage: 'English',
        subtitleSize: 'medium',
        aspectRatio: 'contain',
        theme: 'midnight-glass',
        enableHardwareAcceleration: true,
        bufferSizeMB: 128
      }
    }
  };
}

export function validateAndRestoreVegaBackup(backupJson: any) {
  if (!backupJson || (!backupJson.data && !backupJson.watchlist)) {
    throw new Error('Invalid backup file format: missing Vega payload data');
  }
  const payload = backupJson.data || backupJson;
  return {
    success: true,
    restoredItems: {
      watchlistCount: payload.watchlist?.length || 0,
      historyCount: payload.continueWatching?.length || 0,
      downloadsCount: payload.downloads?.length || 0,
      providerOrder: payload.providerOrder || [],
      settings: payload.settings || {}
    },
    data: payload
  };
}
