import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { appBuildDirectory, providerBuildDirectory, repositoryRoot } from './repository.js';
import { getAllVegaProviders, getVegaManifestAndUrls } from './vegaProvider.js';
import { safeMediaUrl, storedSources } from './sources.js';
import { providerFetch } from './providerNetwork.js';
import { withDeadline } from './deadline.js';
import { episodeIdentity, seasonNumber, matchesEpisode } from './episodeIdentity.js';

const require = createRequire(path.join(repositoryRoot, 'package.json'));
const normalize = (value: unknown) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function matchesMovie(item: any, meta: any) {
  const type = item.type || 'movie';
  const identity = item.imdb_id || (/^tt\d+$/.test(item.id) ? item.id : null);
  if (meta?.type === type && identity && meta.imdbId === identity) return true;
  return meta?.type === type && normalize(item.title) === normalize(meta.title) &&
    !!item.year && String(meta.year || meta.releaseDate || '').slice(0, 4) === String(item.year);
}
export function normalizeDiscoveredStreams(raw: any, provider: string, item: any) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).filter(stream => {
    if (!stream || typeof stream.link !== 'string' || !safeMediaUrl(stream.link) || seen.has(stream.link) ||
      !['mp4', 'webm', 'm3u8', 'hls', 'mpd', 'dash'].includes(String(stream.type).toLowerCase()) ||
      Object.keys(stream.headers || {}).some(key => !['user-agent', 'accept', 'accept-language'].includes(key.toLowerCase()))) return false;
    seen.add(stream.link); return true;
  }).map((stream, index) => ({ id: `${provider}:${index}`, provider, content_id: item.id, episode_id: item.episode_id || '',
    url: stream.link, name: stream.server || provider, server: stream.server || provider,
    format: ({ hls: 'm3u8', dash: 'mpd' } as Record<string, string>)[String(stream.type).toLowerCase()] || String(stream.type).toLowerCase(),
    type: 'direct', provenance: `Original ${provider} stream module`, subtitles: [],
  }));
}

// Backend-only stream validation (session plumbing scope; player fallback untouched).
// Some providers return HTTP-200 HLS manifests whose segments are JPEG slideshows,
// which can never decode as video. These helpers give positive image/non-video
// evidence so discovery keeps searching other providers instead of stopping early.
export function segmentUrlLooksLikeImage(url: string) {
  return /\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|#|$)/i.test(String(url || '').split(/[?#]/)[0]);
}

function bytesLookLikeImage(bytes: Buffer) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  if (bytes.length >= 6 && bytes.toString('latin1', 0, 6).startsWith('GIF8')) return true;
  if (bytes.length >= 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') return true;
  return false;
}

function headerLooksLikeVideo(headers: any[], url: string) {
  const contentType = headers.find(([key]) => String(key).toLowerCase() === 'content-type')?.[1];
  if (typeof contentType === 'string') {
    if (/^video\//i.test(contentType)) return true;
    if (/^image\//i.test(contentType)) return false;
  }
  if (/\.(ts|m4s|mp4|webm)(\?|#|$)/i.test(url.split(/[?#]/)[0])) return true;
  return null;
}

function responseBytes(response: any) {
  try { return Buffer.from(String(response?.bodyBase64 || ''), 'base64'); } catch { return Buffer.alloc(0); }
}

function playlistSegmentUrls(manifest: string, base: string) {
  const urls: string[] = [];
  for (const line of manifest.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    try { urls.push(new URL(trimmed, base).href); } catch { /* skip unresolvable entries */ }
    if (urls.length >= 3) break;
  }
  return urls;
}

async function hlsHasPlayableVideo(manifestUrl: string, signal: AbortSignal, depth = 0): Promise<boolean | null> {
  if (depth > 1) return null;
  const manifest = await providerFetch(manifestUrl, { method: 'GET' }, signal);
  if (manifest.status < 200 || manifest.status >= 300) return null;
  const text = responseBytes(manifest).toString('utf8');
  if (!text.includes('#EXTM3U')) return false;
  if (/#EXT-X-STREAM-INF/i.test(text)) {
    const variants = playlistSegmentUrls(text, manifestUrl).filter(entry => !segmentUrlLooksLikeImage(entry));
    if (!variants.length) return false;
    return hlsHasPlayableVideo(variants[0], signal, depth + 1);
  }
  const segments = playlistSegmentUrls(text, manifestUrl);
  if (!segments.length) return false;
  if (segments.some(segmentUrlLooksLikeImage)) return false;
  for (const segment of segments.slice(0, 2)) {
    try {
      const response = await providerFetch(segment, { method: 'GET', headers: { Range: 'bytes=0-1023' } }, signal);
      if (response.status < 200 || response.status >= 300) continue;
      const videoHint = headerLooksLikeVideo(response.headers || [], segment);
      if (videoHint === false) return false;
      const bytes = responseBytes(response);
      if (bytes.length && bytesLookLikeImage(bytes)) return false;
      if (videoHint === true) return true;
    } catch { /* fail open on transient validation errors */ }
  }
  return null;
}

async function streamHasPlayableVideo(source: any, signal: AbortSignal): Promise<boolean | null> {
  try {
    if (source.format === 'm3u8') return await hlsHasPlayableVideo(source.url, signal);
    const head = await providerFetch(source.url, { method: 'HEAD' }, signal);
    const hint = headerLooksLikeVideo(head.headers || [], source.url);
    if (hint !== null) return hint;
    return null;
  } catch { return null; }
}

// Fail open: only drop streams with positive image/non-video evidence so a
// flaky validation request never blocks a genuinely playable provider.
export async function validateDiscoveredStreams(sources: any[], signal: AbortSignal) {
  const results = await Promise.all(sources.map(async source => {
    if (source.format !== 'm3u8' && source.format !== 'mp4' && source.format !== 'webm') return { source, keep: true };
    const verdict = await withDeadline(streamHasPlayableVideo(source, signal), 12000).catch(() => null);
    return { source, keep: verdict !== false };
  }));
  return { valid: results.filter(entry => entry.keep).map(entry => entry.source), rejected: results.length - results.filter(entry => entry.keep).length };
}

let active = false;
const cache = new Map<string, { expires: number; result: any }>();
export function orderProviders<T extends { value: string; disabled?: boolean }>(providers: T[], disabled: string[], order: string[]) {
  const rank = new Map([...new Set(order)].map((id, index) => [id, index]));
  return providers.filter(provider => !provider.disabled && !disabled.includes(provider.value))
    .sort((left, right) => (rank.get(left.value) ?? rank.size) - (rank.get(right.value) ?? rank.size));
}
export async function discoverMovie(item: any, disabled: string[] = [], requestSignal?: AbortSignal, order: string[] = [], only: string[] = []) {
  const configured = storedSources(item.type, item.id, item.episode_id || '');
  if (configured.length && !only.length) return { sources: configured, diagnostics: [], providers: [{ provider: 'catalog', streams: configured }] };
  const targetEpisode = item.type === 'series' ? episodeIdentity(item) : null;
  if (item.type === 'series' && !targetEpisode) return { sources: [], providers: [], diagnostics: ['The selected episode is missing its season or episode number. Choose an episode from the title details.'] };
  const key = JSON.stringify(['v2', item.id, item.type, item.episode_id, targetEpisode, item.title, item.year, [...disabled].sort(), order, only]);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.result;
  if (active) return { sources: [], providers: [], diagnostics: ['Provider discovery is busy. Retry shortly.'], busy: true };
  active = true;
  const controller = new AbortController();
  const signal = requestSignal ? AbortSignal.any([requestSignal, controller.signal]) : controller.signal;
  const deadline = setTimeout(() => controller.abort(), 35000);
  let browser: any;
  try {
    const runtime = fs.readFileSync(path.join(appBuildDirectory, 'sandbox-document.js'), 'utf8');
    const { chromium } = require('@playwright/test');
    browser = await chromium.launch({ headless: true, timeout: 10000 });
    const { urlsMap } = getVegaManifestAndUrls();
    const providers = orderProviders(getAllVegaProviders(), disabled, order).filter(provider => !only.length || only.includes(provider.value));
    let foundSource = false;
    const reports: any[] = [];
    let cursor = 0;
    const workers = Promise.all(Array.from({ length: 8 }, async () => {
      while (cursor < providers.length && !signal.aborted) {
        const provider = providers[cursor++];
        const directory = path.join(providerBuildDirectory, provider.value);
        if (!['posts', 'meta', 'stream'].every(module => fs.existsSync(path.join(directory, module + '.js')))) {
          reports.push({ provider: provider.value, streams: [], status: 'unsupported', message: 'No searchable movie modules' }); continue;
        }
        const local = new AbortController();
        const invocationSignal = AbortSignal.any([signal, local.signal]);
        let context: any;
        try { context = await withDeadline(browser.newContext({ serviceWorkers: 'block' }), 3000); }
        catch { reports.push({ provider: provider.value, streams: [], status: 'error', message: 'Provider browser context unavailable' }); continue; }
        let timer = setTimeout(() => local.abort(), 12000);
        const cancel = () => { void context.close().catch(() => {}); };
        invocationSignal.addEventListener('abort', cancel, { once: true });
        const state: Record<string, any> = {}; const kv = new Map(); let calls = 0;
        let unsupported = '';
        try {
          invocationSignal.throwIfAborted();
          await context.route('**/*', (route: any) => route.abort());
          await context.routeWebSocket('**/*', (socket: any) => socket.close());
          const page = await context.newPage();
          await page.exposeFunction('providerRpc', async (operation: string, args: any) => {
            invocationSignal.throwIfAborted();
            if (++calls > 80) throw new Error('Provider operation limit exceeded');
            if (operation === 'fetch') {
              if (/^https:\/\/raw\.githubusercontent\.com\/Zenda-Cross\/vega-providers\/(?:refs\/heads\/)?main\/urls\.json$/.test(args.url)) return { status: 200, statusText: 'OK', url: args.url, headers: [], bodyBase64: Buffer.from(JSON.stringify(urlsMap)).toString('base64') };
              return providerFetch(args.url, args.init || {}, invocationSignal);
            }
            if (operation === 'getBaseUrl') { if (!urlsMap[args.providerValue]?.url) throw new Error('Provider URL unavailable'); return urlsMap[args.providerValue].url; }
            if (operation === 'kvGet') return kv.get(args.key);
            if (operation === 'kvSet') { kv.set(args.key, args.value); return null; }
            if (operation === 'kvDelete') return kv.delete(args.key);
            if (operation === 'kvKeys') return [...kv.keys()];
            if (operation === 'kvClear') { kv.clear(); return null; }
            unsupported = `Unsupported backend capability: ${operation}`;
            throw new Error(unsupported);
          });
          await page.evaluate(`window.pendingInvocations = new Map(); window.ReactNativeWebView = { postMessage: async value => {
            const message = JSON.parse(value);
            if (message.type === 'rpc') {
              try { const result = await window.providerRpc(message.operation, message.args || {}); window.__sandboxReceive(JSON.stringify({type:'rpc-result',token:message.token,id:message.id,result})); }
              catch(error) { window.__sandboxReceive(JSON.stringify({type:'rpc-result',token:message.token,id:message.id,error:error.message})); }
            } else if (message.type === 'result') { const pending = window.pendingInvocations.get(message.token); if(pending) { window.pendingInvocations.delete(message.token); message.error ? pending.reject(new Error(message.error)) : pending.resolve(message); } }
          }};`);
          await page.addScriptTag({ content: runtime });
          const invoke = async (module: string, exportName: string, args: any) => {
            invocationSignal.throwIfAborted();
            const message = { type: 'invoke', token: randomUUID(), moduleCode: fs.readFileSync(path.join(directory, module + '.js'), 'utf8'), exportName, args: { ...args, providerValue: provider.value, provider: provider.value, commonHeaders: {} }, state, timeoutMs: 7000 };
            const response = await page.evaluate((message: any) => new Promise((resolve, reject) => {
              const host = globalThis as any; host.pendingInvocations.set(message.token, { resolve, reject }); host.__sandboxReceive(JSON.stringify(message));
            }), message);
            Object.assign(state, response.state || {}); return response.result;
          };
          const posts = await invoke('posts', 'getSearchPosts', { searchQuery: item.title, page: 1 });
          let streams: any[] = [];
          let providerSlideshow = false;
          for (const post of (Array.isArray(posts) ? posts : []).filter(post => normalize(post.title).includes(normalize(item.title))).slice(0, 3)) {
            const meta = await invoke('meta', 'getMeta', { link: post.link });
            if (!matchesMovie(item, meta)) continue;
            // An exact title match earns time for multi-hop extraction, but never
            // extends the request-wide deadline.
            clearTimeout(timer);
            timer = setTimeout(() => local.abort(), 20000);
            const links: any[] = [];
            for (const group of (Array.isArray(meta.linkList) ? meta.linkList : [])) {
              if (!targetEpisode) { links.push(...(group.directLinks || [])); continue; }
              const season = seasonNumber(group);
              links.push(...(group.directLinks || []).filter((entry: any) => matchesEpisode(entry, targetEpisode, season)));
              if (season === targetEpisode.season && group.episodesLink && fs.existsSync(path.join(directory, 'episodes.js'))) {
                const episodes = await invoke('episodes', 'getEpisodes', { url: group.episodesLink });
                links.push(...(Array.isArray(episodes) ? episodes : []).filter(entry => matchesEpisode(entry, targetEpisode, season)));
              }
              if (links.length) break;
            }
            for (const link of links.slice(0, 3)) {
              streams.push(...normalizeDiscoveredStreams(await invoke('stream', provider.value === 'moviesApi' ? 'mpGetStream' : 'getStream', { link: link.link, type: item.type, isDownload: false }), provider.value, item));
            }
            if (streams.length) {
              const validation = await validateDiscoveredStreams(streams, invocationSignal);
              providerSlideshow = !validation.valid.length && validation.rejected > 0;
              streams = validation.valid;
            }
            if (streams.length) break;
          }
          reports.push({ provider: provider.value, streams, status: streams.length ? 'resolved' : unsupported ? 'unsupported' : providerSlideshow ? 'slideshow' : 'unavailable', message: unsupported || (providerSlideshow ? 'Returned image slideshow segments instead of playable video; continuing with other providers' : undefined) });
          if (streams.length) { foundSource = true; controller.abort(); }
        } catch (error) {
          reports.push({ provider: provider.value, streams: [], status: foundSource ? 'cancelled' : invocationSignal.aborted ? 'timeout' : 'error', message: foundSource ? 'Stopped after another provider returned a source' : unsupported || (error instanceof Error ? error.message : 'Provider failed') });
        } finally {
          clearTimeout(timer); invocationSignal.removeEventListener('abort', cancel); local.abort(); await withDeadline(context.close(), 1000).catch(() => {});
        }
      }
    }));
    await withDeadline(workers, 36000).catch(() => { controller.abort(); });
    // Snapshot completed reports: late worker cleanup cannot mutate this response.
    const completed = [...reports];
    for (const provider of providers.filter(provider => !completed.some(report => report.provider === provider.value))) completed.push({ provider: provider.value, streams: [], status: foundSource ? 'not-needed' : 'timeout', message: foundSource ? 'A supported source was already found' : 'Discovery deadline reached before this provider completed' });
    requestSignal?.throwIfAborted();
    const seen = new Set();
    const sources = completed.flatMap(report => report.streams).filter(source => { if (seen.has(source.url)) return false; seen.add(source.url); return true; });
    const result = { sources, providers: completed, diagnostics: sources.length ? [] : ['No exact title/year match with supported browser media was returned.', ...completed.filter(report => report.message).map(report => `${report.provider}: ${String(report.message).slice(0, 180)}`)] };
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + (sources.length ? 60000 : 15000), result });
    return result;
  } catch (error) {
    requestSignal?.throwIfAborted();
    return { sources: [], providers: [], diagnostics: [`Backend provider discovery unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`] };
  } finally {
    clearTimeout(deadline); controller.abort();
    try { if (browser) await withDeadline(browser.close(), 1500).catch(() => {}); }
    finally { active = false; }
  }
}