import { Hono } from 'hono';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { createPlaybackToken, verifyPlaybackToken, PLAYBACK_TOKEN_EXPIRE_SECONDS } from '../services/playback.js';
import { storedSources } from '../services/sources.js';
import { discoverMovie } from '../services/providerDiscovery.js';
import { catalogItems } from '../services/database.js';

export const playbackRouter = new Hono();
const requestSchema = z.object({ content_type: z.enum(['movie', 'series']), content_id: z.string().min(1).max(150), episode_id: z.string().min(1).max(150).nullable().optional(), country_code: z.string().regex(/^[A-Z]{2}$/).optional() }).strict();
playbackRouter.get('/sources/:type/:id', c => {
  const { type, id } = c.req.param();
  const episode = c.req.query('episode_id') || '';
  if (!['movie', 'series'].includes(type) || id.length > 150 || episode.length > 150) return c.json({ error: 'Invalid content identity' }, 400);
  const sources = storedSources(type, id, episode);
  return c.json({ content_id: id, type, episode_id: episode || null, sources, status: sources.length ? 'resolved' : 'unavailable' });
});
// Short-lived session store for dynamically discovered provider streams.
// Catalog `sources` cannot cover every live provider result. This bridges that
// gap: /session falls back to fresh backend discovery, and the returned token
// consults this store before the pre-configured catalog rows.
const sessionSources = new Map<string, { expires: number; sources: any[] }>();

function rememberSessionSources(sessionId: string, sources: any[]) {
  sessionSources.set(sessionId, { expires: Date.now() + PLAYBACK_TOKEN_EXPIRE_SECONDS * 1000, sources });
  if (sessionSources.size > 500) sessionSources.delete(sessionSources.keys().next().value!);
  for (const [key, entry] of sessionSources) {
    if (entry.expires <= Date.now()) sessionSources.delete(key);
  }
}

function sessionDiscoveredSources(sessionId: string | undefined, contentType: string, contentId: string, episodeId = '') {
  if (!sessionId) return [];
  const entry = sessionSources.get(sessionId);
  if (!entry || entry.expires <= Date.now()) {
    if (entry) sessionSources.delete(sessionId);
    return [];
  }
  return entry.sources.filter(source => source && source.content_id === contentId && (source.episode_id || '') === episodeId);
}

playbackRouter.post('/session', async c => {
  const parsed = requestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid playback request' }, 400);
  const body = parsed.data;
  let sources = storedSources(body.content_type, body.content_id, body.episode_id || '');
  let discovered = false;
  if (!sources.length) {
    // Fall back to live backend provider discovery for unconfigured titles.
    // Stored sources remain authoritative when present; discovered streams are
    // cached only for the session so third-party results stay title-scoped.
    const item = catalogItems().find(entry => entry.id === body.content_id && entry.type === body.content_type);
    if (item) {
      const result = await discoverMovie({ ...item, episode_id: body.episode_id }, [], c.req.raw.signal, []);
      if (result.busy) return c.json({ error: 'Provider discovery is busy. Retry shortly.', code: 'DISCOVERY_BUSY' }, 503);
      if (result.sources.length) {
        sources = result.sources;
        discovered = true;
      }
    }
  }
  if (!sources.length) return c.json({ error: 'No configured source for this title', code: 'SOURCE_UNAVAILABLE' }, 409);
  const now = Math.floor(Date.now() / 1000);
  const sessionId = `ses_${randomUUID()}`;
  const token = createPlaybackToken({ sub: 'public-playback', session_id: sessionId, content_type: body.content_type, content_id: body.content_id, episode_id: body.episode_id || null, iat: now, exp: now + PLAYBACK_TOKEN_EXPIRE_SECONDS });
  if (discovered) rememberSessionSources(sessionId, sources);
  return c.json({ session_id: sessionId, token, expires_in: PLAYBACK_TOKEN_EXPIRE_SECONDS, content_id: body.content_id, content_type: body.content_type, sources, stream_url: sources[0].url, qualities: [], subtitles: [] }, 201);
});
playbackRouter.get('/:type/:id/session', c => {
  const token = verifyPlaybackToken(c.req.query('token') || '');
  if (!token || token.content_id !== c.req.param('id') || token.content_type !== c.req.param('type')) return c.json({ error: 'Invalid or expired playback token' }, 403);
  const episodeId = String(token.episode_id || '');
  const discovered = sessionDiscoveredSources(String(token.session_id || ''), String(token.content_type), String(token.content_id), episodeId);
  const sources = discovered.length ? discovered : storedSources(String(token.content_type), String(token.content_id), episodeId);
  return c.json({ content_id: token.content_id, content_type: token.content_type, episode_id: token.episode_id, sources });
});

const discoverySchema = requestSchema.extend({ season_number: z.number().int().min(0).max(1000).optional(), episode_number: z.number().int().min(1).max(10000).optional(), disabled_providers: z.array(z.string().max(80)).max(100).optional(), provider_order: z.array(z.string().max(80)).max(100).optional() });
playbackRouter.post('/discover-streams', async c => {
  const parsed = discoverySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid discovery request' }, 400);
  const body = parsed.data;
  const item = catalogItems().find(item => item.id === body.content_id && item.type === body.content_type);
  if (!item) return c.json({ error: 'Catalog title not found' }, 404);
  const result = await discoverMovie({ ...item, episode_id: body.episode_id, season_number: body.season_number, episode_number: body.episode_number }, body.disabled_providers, c.req.raw.signal, body.provider_order);
  return c.json({ content_id: item.id, content_type: item.type, ...result }, result.busy ? 503 : 200);
});

// Direct single-provider stream lookup for the browser Vega adapter.
// The browser sandbox fails for cookie/WebView-gated providers; when the
// player has no cached provider_link it asks the API host to run the same
// backend discovery but scoped to one provider.
const providerStreamSchema = z.object({ content_id: z.string().min(1).max(150), content_type: z.enum(['movie', 'series']), provider: z.string().min(1).max(80), episode_id: z.string().min(1).max(150).optional(), season_number: z.number().int().min(0).max(1000).optional(), episode_number: z.number().int().min(1).max(10000).optional() }).strict();
playbackRouter.post('/provider-streams', async c => {
  const parsed = providerStreamSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid provider stream request' }, 400);
  const body = parsed.data;
  const item = catalogItems().find(entry => entry.id === body.content_id && entry.type === body.content_type);
  if (!item) return c.json({ error: 'Catalog title not found' }, 404);
  const result = await discoverMovie({ ...item, episode_id: body.episode_id, season_number: body.season_number, episode_number: body.episode_number }, [], c.req.raw.signal, [], [body.provider]);
  const report = result.providers.find((entry: any) => entry.provider === body.provider);
  const sources = result.sources.filter((source: any) => source.provider === body.provider);
  if (result.busy) return c.json({ content_id: item.id, content_type: item.type, sources, status: 'busy', diagnostics: ['Provider discovery is busy. Retry shortly.'] }, 503);
  if (!report) return c.json({ content_id: item.id, content_type: item.type, sources: [], status: 'unavailable', diagnostics: ['Provider did not participate in discovery.'] });
  if (!sources.length) return c.json({ content_id: item.id, content_type: item.type, sources: [], status: report.status || 'unavailable', diagnostics: [report.message || 'No browser-playable source was returned for this provider title.'] });
  return c.json({ content_id: item.id, content_type: item.type, sources, status: 'resolved', diagnostics: [] });
});

// Stable forward-only queue. Discovery happens one title at a time in the player.
playbackRouter.get('/next-playable/:type/:currentId', c => {
  const { type, currentId } = c.req.param();
  if (type !== 'movie' || currentId.length > 150) return c.json({ error: 'Invalid movie identity' }, 400);
  const items = catalogItems().filter(item => item.type === 'movie');
  const index = items.findIndex(item => item.id === currentId);
  if (index < 0) return c.json({ error: 'Current item not found' }, 404);
  return c.json({ next: items[index + 1] || null, candidates: items.slice(index + 1) });
});
// Generated demo HLS/DASH manifests and dialogue are deliberately retired:
// a media format/track is exposed only when it belongs to the resolved source.
playbackRouter.get('/:type/:id/manifest.m3u8', c => c.json({ error: 'Use the source URL supplied by the resolver' }, 410));
playbackRouter.get('/:type/:id/manifest.mpd', c => c.json({ error: 'Use the source URL supplied by the resolver' }, 410));

