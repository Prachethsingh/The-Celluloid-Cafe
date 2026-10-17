import { safePlaybackUrl } from '../streamSources';
import { titleArtworkUrl } from '../artwork';

const STORAGE_KEY = 'mp_stremio_addons';
const text = (value, max = 300) => typeof value === 'string' ? value.slice(0, max) : '';
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');

export function manifestUrl(value) {
  if (!safePlaybackUrl(value) || value.startsWith('/')) throw new Error('Use a public HTTPS add-on manifest URL.');
  const url = new URL(value);
  if (!url.pathname.endsWith('/manifest.json') || url.search || url.hash) throw new Error('The add-on URL must end in /manifest.json without a query or fragment.');
  return url.href;
}

export function validateManifest(value) {
  if (!value || typeof value.id !== 'string' || !value.id || value.id.length > 120 || typeof value.name !== 'string' || !value.name.trim() || !/^\d+\.\d+\.\d+/.test(value.version || '') || !Array.isArray(value.types) || !Array.isArray(value.resources) || !Array.isArray(value.catalogs)) throw new Error('The add-on returned an invalid manifest.');
  const types = value.types.filter(type => ['movie', 'series'].includes(type));
  if (value.resources.some(resource => typeof resource !== 'string' && (!resource || typeof resource.name !== 'string' || (resource.types !== undefined && (!Array.isArray(resource.types) || resource.types.some(type => typeof type !== 'string'))) || (resource.idPrefixes !== undefined && (!Array.isArray(resource.idPrefixes) || resource.idPrefixes.some(prefix => typeof prefix !== 'string')))))) throw new Error('The add-on returned invalid resource capabilities.');
  const resources = value.resources.filter(resource => ['catalog', 'meta', 'stream'].includes(typeof resource === 'string' ? resource : resource?.name));
  if (!types.length || !resources.length) throw new Error('This add-on has no movie or series resources supported by CinePulse.');
  if (value.behaviorHints?.configurationRequired) throw new Error('Configure this add-on first, then use its configured manifest URL.');
  return { id: value.id, name: text(value.name, 120), version: text(value.version, 40), types, resources, idPrefixes: Array.isArray(value.idPrefixes) ? value.idPrefixes.filter(prefix => typeof prefix === 'string') : undefined, catalogs: value.catalogs.filter(catalog => catalog && types.includes(catalog.type) && typeof catalog.id === 'string' && catalog.id.length <= 120).slice(0, 50).map(catalog => ({ ...catalog, extra: Array.isArray(catalog.extra) ? catalog.extra.filter(extra => extra && typeof extra.name === 'string') : [] })) };
}

async function request(url, signal) {
  const response = await fetch(url, { credentials: 'omit', redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'The add-on denied access. Check its configured account.' : `Add-on request failed (${response.status}).`);
  const body = await response.text();
  if (body.length > 2_000_000) throw new Error('Add-on response exceeds the supported size.');
  try { return JSON.parse(body); } catch { throw new Error('The add-on did not return JSON.'); }
}

export function installedAddons() {
  try {
    const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return (Array.isArray(entries) ? entries : []).slice(0, 20).flatMap(entry => {
      try { if (!/^stremio:[a-f0-9]{32}$/.test(entry.id)) return []; return [{ id: entry.id, url: manifestUrl(entry.url), manifest: validateManifest(entry.manifest) }]; } catch { return []; }
    });
  } catch { return []; }
}
export async function connectAddon(url, signal) {
  const canonical = manifestUrl(url);
  const manifest = validateManifest(await request(canonical, signal));
  return { id: `stremio:${(await hash(canonical)).slice(0, 32)}`, url: canonical, manifest };
}
export function saveAddon(addon) {
  const list = installedAddons().filter(entry => entry.id !== addon.id);
  if (list.length >= 20) throw new Error('Remove an add-on before connecting another.');
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...list, addon]));
}
export function removeAddon(id) { localStorage.setItem(STORAGE_KEY, JSON.stringify(installedAddons().filter(entry => entry.id !== id))); }

function supports(manifest, name, type, id) {
  return manifest.resources.some(resource => {
    const details = typeof resource === 'string' ? { name: resource, types: manifest.types, idPrefixes: manifest.idPrefixes } : resource;
    const prefixes = details.idPrefixes;
    return details.name === name && (details.types || manifest.types).includes(type) && (name === 'catalog' || !Array.isArray(prefixes) || prefixes.some(prefix => typeof prefix === 'string' && id.startsWith(prefix)));
  });
}

export function createStremioAdapter(addon) {
  const manifest = validateManifest(addon.manifest);
  const base = manifestUrl(addon.url).slice(0, -'/manifest.json'.length);
  const resource = (name, type, id, extras = '') => `${base}/${name}/${encodeURIComponent(type)}/${encodeURIComponent(id)}${extras ? '/' + extras : ''}.json`;
  const media = async value => {
    if (!value || typeof value.id !== 'string' || !value.id || value.id.length > 300 || typeof value.name !== 'string' || !value.name || !manifest.types.includes(value.type)) return null;
    return { id: `${addon.id}:${(await hash(value.type + ':' + value.id)).slice(0, 32)}`, title: text(value.name), type: value.type, addon_id: addon.id, addon_media_id: value.id, metadata_provenance: 'stremio-addon', artwork_provenance: 'addon-id-record', poster_url: titleArtworkUrl(value.poster), backdrop_url: titleArtworkUrl(value.background), description: text(value.description, 5000), genres: Array.isArray(value.genres) ? value.genres.filter(genre => typeof genre === 'string') : [], year: /^\d{4}/.test(value.releaseInfo || '') ? Number(value.releaseInfo.slice(0, 4)) : null };
  };
  const browse = async (catalog, { query = '', skip = 0, signal } = {}) => {
    if (!supports(manifest, 'catalog', catalog.type, catalog.id)) throw new Error('This add-on does not support that catalog.');
    const extras = catalog.extra || [];
    if (query && !extras.some(extra => extra.name === 'search')) throw new Error('This catalog does not support search.');
    if (extras.some(extra => extra.isRequired && (extra.name !== 'search' || !query.trim()))) throw new Error('This catalog requires filters not supplied by this request.');
    const values = [query.trim() ? 'search=' + encodeURIComponent(query.trim()) : '', skip > 0 && extras.some(extra => extra.name === 'skip') ? 'skip=' + skip : ''].filter(Boolean).join('&');
    const response = await request(resource('catalog', catalog.type, catalog.id, values), signal);
    if (!Array.isArray(response.metas)) throw new Error('The add-on returned an invalid catalog response.');
    const results = (await Promise.all(response.metas.slice(0, 100).filter(item => item?.type === catalog.type).map(media))).filter(Boolean);
    return [...new Map(results.map(item => [item.id, item])).values()];
  };
  return {
    id: addon.id, kind: 'stremio', catalogs: manifest.catalogs, browse,
    search: async (query, options = {}) => {
      const catalogs = manifest.catalogs.filter(catalog => catalog.extra.some(extra => extra.name === 'search'));
      if (!catalogs.length) throw new Error('This add-on has no searchable catalogs.');
      const results = (await Promise.all(catalogs.map(catalog => browse(catalog, { ...options, query })))).flat();
      return [...new Map(results.map(item => [item.id, item])).values()];
    },
    getMetadata: async (item, { signal } = {}) => {
      if (!supports(manifest, 'meta', item.type, item.addon_media_id)) return { item, episodes: [] };
      const response = await request(resource('meta', item.type, item.addon_media_id), signal);
      if (response.meta?.id !== item.addon_media_id || response.meta?.type !== item.type) throw new Error('The add-on returned metadata for a different title.');
      const updated = await media(response.meta);
      if (!updated) throw new Error('The add-on returned incomplete title metadata.');
      const episodes = await Promise.all((Array.isArray(response.meta.videos) ? response.meta.videos : []).filter(video => video && typeof video.id === 'string' && video.id.length <= 300).slice(0, 500).map(async video => ({ id: 'episode:' + (await hash(addon.id + ':' + video.id)).slice(0, 32), addon_video_id: video.id, title: text(video.title || video.name) || `Episode ${video.episode || ''}`, season: video.season, episode_number: video.episode })));
      return { item: updated, episodes };
    },
    getStreams: async (item, { signal } = {}) => {
      const id = item.type === 'series' ? item.episode?.addon_video_id : item.addon_media_id;
      if (!id) throw new Error('Choose a specific episode before requesting series streams.');
      if (!supports(manifest, 'stream', item.type, id)) return [];
      const response = await request(resource('stream', item.type, id), signal);
      if (!Array.isArray(response.streams)) throw new Error('The add-on returned an invalid stream response.');
      const seen = new Set();
      return response.streams.filter(stream => {
        if (!stream || !safePlaybackUrl(stream.url) || stream.infoHash || stream.externalUrl || stream.behaviorHints?.proxyHeaders || seen.has(stream.url)) return false;
        seen.add(stream.url); return true;
      }).slice(0, 50).map((stream, index) => ({ id: `${addon.id}:${index}`, provider: manifest.name, content_id: item.id, episode_id: item.episode?.id || null, url: stream.url, name: text(stream.name, 120) || manifest.name, format: /\.m3u8(?:[?#]|$)/i.test(stream.url) ? 'm3u8' : /\.mpd(?:[?#]|$)/i.test(stream.url) ? 'mpd' : /\.webm(?:[?#]|$)/i.test(stream.url) ? 'webm' : /\.mp4(?:[?#]|$)/i.test(stream.url) ? 'mp4' : 'video', quality: null, provenance: `Stremio add-on ${manifest.id}`, subtitles: [] }));
    },
  };
}
