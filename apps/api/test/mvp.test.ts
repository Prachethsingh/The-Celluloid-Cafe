import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/index.js';
import { getDatabase } from '../src/services/database.js';
import { createPlaybackToken, verifyPlaybackToken } from '../src/services/playback.js';
import { safeMediaUrl } from '../src/services/sources.js';
import { DatabaseSync } from 'node:sqlite';
import { migrateSourceFormats } from '../src/services/sourceMigration.js';
import { syncCatalogRecords } from '../src/services/catalogSync.js';
import { removeDemoCatalogData } from '../src/services/database.js';
import { matchesMovie, normalizeDiscoveredStreams, orderProviders, segmentUrlLooksLikeImage, validateDiscoveredStreams } from '../src/services/providerDiscovery.js';
import { publicIPv4, providerFetch } from '../src/services/providerNetwork.js';
import { withDeadline } from '../src/services/deadline.js';
import { episodeIdentity, seasonNumber, matchesEpisode } from '../src/services/episodeIdentity.js';

type Identity = { cookie: string; csrf: string; user: any };
async function register(name: string): Promise<Identity> {
  const response = await app.request('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${name}-${randomUUID()}@example.test`, password: 'a-long-test-password', display_name: name }) });
  assert.equal(response.status, 201);
  const body = await response.json();
  const cookie = response.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  return { cookie: cookie.split(';')[0], csrf: body.csrf, user: body.user };
}
function headers(identity: Identity) { return { Cookie: identity.cookie, 'X-CSRF-Token': identity.csrf, 'Content-Type': 'application/json' }; }

describe('MVP identity, persistence, and real source contracts', () => {
  test('backend series discovery retains exact season and episode identity', () => {
    const target = episodeIdentity({ episode_id: 'tt1234567:2:3' });
    assert.deepEqual(target, { season: 2, episode: 3 });
    assert.equal(episodeIdentity({ episode_id: 'unknown' }), null);
    assert.equal(seasonNumber({ title: 'Season 2' }), 2);
    assert.equal(matchesEpisode({ title: 'Episode 3', link: 'https://example.test/3' }, target!, 2), true);
    assert.equal(matchesEpisode({ title: 'S02E03', link: 'https://example.test/3' }, target!, null), true);
    assert.equal(matchesEpisode({ title: 'Episode 3', link: 'https://example.test/3' }, target!, 1), false);
    assert.equal(matchesEpisode({ title: 'Episodes 3-5', link: 'https://example.test/pack' }, target!, 2), false);
    assert.equal(matchesEpisode({ title: 'Episode 3', link: 'https://example.test/3' }, target!, null), false);
    const item = { id: 'tt1234567', type: 'series', episode_id: 'tt1234567:2:3' };
    assert.equal(matchesMovie(item, { type: 'series', imdbId: item.id }), true);
    assert.equal(matchesMovie(item, { type: 'movie', imdbId: item.id }), false);
    const sources = normalizeDiscoveredStreams([{ type: 'mp4', link: 'https://example.test/3.mp4' }], 'fixture', item);
    assert.equal(sources[0].episode_id, item.episode_id);
  });
  test('discovery rejects image slideshow segments instead of treating them as playable', async () => {
    assert.equal(segmentUrlLooksLikeImage('https://example.test/clip/0.jpg?t=123'), true);
    assert.equal(segmentUrlLooksLikeImage('https://example.test/clip/0.ts'), false);
    const controller = new AbortController();
    const verdict = await validateDiscoveredStreams([{ format: 'mpd', url: 'https://example.test/manifest.mpd', provider: 'fixture', content_id: 'tt0000000' }], controller.signal);
    assert.equal(verdict.valid.length, 1);
    assert.equal(verdict.rejected, 0);
  });
  test('discovery follows saved priority without re-enabling user or upstream opt-outs', () => {
    const providers = [{ value: 'a' }, { value: 'b' }, { value: 'c', disabled: true }, { value: 'd' }];
    assert.deepEqual(orderProviders(providers, ['a'], ['d', 'c', 'd', 'unknown']).map(p => p.value), ['d', 'b']);
    assert.deepEqual(orderProviders(providers, [], []).map(p => p.value), ['a', 'b', 'd']);
  });
  test('provider deadlines reject stalled operations and preserve success/errors', async () => {
    await assert.rejects(withDeadline(new Promise(() => {}), 10), /deadline exceeded/);
    assert.equal(await withDeadline(Promise.resolve('ok'), 100), 'ok');
    await assert.rejects(withDeadline(Promise.reject(new Error('upstream')), 100), /upstream/);
  });
  test('provider matching requires a confirmed movie identity, not a similar title', () => {
    const item = { id: 'tt0816692', title: 'Interstellar', year: 2014 };
    assert.equal(matchesMovie(item, { title: 'Interstellar', year: 2014, type: 'movie' }), true);
    assert.equal(matchesMovie(item, { title: 'Translated title', imdbId: item.id, type: 'movie' }), true);
    assert.equal(matchesMovie(item, { title: 'Interstellar', year: 2024, type: 'movie' }), false);
    assert.equal(matchesMovie(item, { title: 'Interstellar', type: 'movie' }), false);
    assert.equal(matchesMovie(item, { title: 'Interstellar', year: 2014, type: 'series' }), false);
  });
  test('discovery normalizes sources and rejects embeds, duplicates and required custom headers', () => {
    const streams = normalizeDiscoveredStreams([
      { link: 'https://media.example.test/movie.m3u8', type: 'hls' },
      { link: 'https://media.example.test/movie.m3u8', type: 'hls' },
      { link: 'https://media.example.test/embed', type: 'embed' },
      { link: 'https://media.example.test/private.mp4', type: 'mp4', headers: { Referer: 'https://example.test' } },
      { link: 'https://127.0.0.1/movie.mp4', type: 'mp4' },
    ], 'fixture', { id: 'movie-1' });
    assert.equal(streams.length, 1);
    assert.equal(streams[0].content_id, 'movie-1');
    assert.equal(streams[0].format, 'm3u8');
  });
  test('backend provider networking blocks private/reserved addresses and unsafe protocols', async () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '224.0.0.1', '::1']) assert.equal(publicIPv4(ip), false);
    assert.equal(publicIPv4('8.8.8.8'), true);
    await assert.rejects(providerFetch('http://example.test', {}, new AbortController().signal), /Blocked/);
    await assert.rejects(providerFetch('https://127.0.0.1', {}, new AbortController().signal), /Blocked/);
  });
  test('discovery validates requests and next movie queue does not wrap', async () => {
    assert.equal((await app.request('/api/v1/playback/discover-streams', { method: 'POST', body: JSON.stringify({ content_type: 'anything', content_id: 'x' }) })).status, 400);
    const db = getDatabase();
    for (const id of ['queue-a', 'queue-b']) db.prepare('INSERT INTO media VALUES(?,?,?,?)').run(id, 'movie', id, JSON.stringify({ id, title: id, type: 'movie', year: 2020 }));
    try {
      const first = await (await app.request('/api/v1/playback/next-playable/movie/queue-a')).json();
      assert.ok(first.candidates.some((item: any) => item.id === 'queue-b'));
      assert.ok(first.candidates.every((item: any) => item.id !== 'queue-a'));
      const last = await (await app.request('/api/v1/playback/next-playable/movie/queue-b')).json();
      assert.equal(last.next, null);
    } finally { db.prepare("DELETE FROM media WHERE id IN ('queue-a','queue-b')").run(); }
  });
  test('adaptive-format migration preserves configured sources and supports DASH', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec("CREATE TABLE migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL); CREATE TABLE sources(id TEXT PRIMARY KEY,content_id TEXT,type TEXT,episode_id TEXT,url TEXT,name TEXT,format TEXT CHECK(format IN ('mp4','webm','m3u8')),provenance TEXT,created_at TEXT); CREATE INDEX source_content ON sources(type,content_id,episode_id); INSERT INTO sources VALUES('existing','m1','movie','','https://media.example.test/file.mp4','Existing','mp4','Owner','2026-10-08');");
      const before = db.prepare('SELECT * FROM sources').all();
      migrateSourceFormats(db);
      assert.deepEqual(db.prepare('SELECT * FROM sources').all(), before);
      db.prepare('INSERT INTO sources VALUES(?,?,?,?,?,?,?,?,?)').run('dash','m2','movie','','https://media.example.test/file.mpd','DASH','mpd','Owner','2026-10-08');
      migrateSourceFormats(db);
      assert.equal(db.prepare('SELECT COUNT(*) count FROM sources').get()?.count, 2);
      assert.equal(safeMediaUrl('/media/test.mpd'), true);
    } finally { db.close(); }
  });
  test('live catalog refresh updates identities without deleting verified availability or sources', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec("CREATE TABLE media(id TEXT PRIMARY KEY,type TEXT NOT NULL,title TEXT NOT NULL,data TEXT NOT NULL); CREATE TABLE sources(id TEXT PRIMARY KEY,content_id TEXT NOT NULL); INSERT INTO media VALUES('tt1234567','movie','Old title', '{\"poster_url\":\"https://images.example.test/poster.jpg\",\"availability_verified\":true,\"availability_provenance\":\"operator-verified\",\"availability\":{\"US\":[{\"platformId\":\"prime\",\"available\":true}]}}'); INSERT INTO sources VALUES('source-1','tt1234567');");
      const count = syncCatalogRecords(db, [{ id: 'tt1234567', type: 'movie', title: 'Updated title', poster_url: null, backdrop_url: null, availability: {}, availability_verified: false, availability_provenance: 'unverified' }]);
      const item = JSON.parse(String(db.prepare('SELECT data FROM media WHERE id=?').get('tt1234567')?.data));
      assert.equal(count, 1);
      assert.equal(db.prepare('SELECT title FROM media WHERE id=?').get('tt1234567')?.title, 'Updated title');
      assert.equal(item.poster_url, 'https://images.example.test/poster.jpg');
      assert.equal(item.availability_verified, true);
      assert.equal(item.availability.US[0].platformId, 'prime');
      assert.equal(db.prepare('SELECT id FROM sources WHERE content_id=?').get('tt1234567')?.id, 'source-1');
      assert.throws(() => syncCatalogRecords(db, []), /no valid title records/);
      assert.equal(db.prepare('SELECT title FROM media WHERE id=?').get('tt1234567')?.title, 'Updated title');
    } finally { db.close(); }
  });
  test('demo cleanup removes only explicitly marked titles and known sample streams', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec("CREATE TABLE media(id TEXT PRIMARY KEY,type TEXT,title TEXT,data TEXT); CREATE TABLE sources(id TEXT PRIMARY KEY,content_id TEXT,url TEXT); INSERT INTO media VALUES('fake','movie','Sample title','{\"metadata_provenance\":\"demo-seed\"}'); INSERT INTO media VALUES('live','movie','Live title','{\"metadata_provenance\":\"cinemeta\"}'); INSERT INTO sources VALUES('sample','fake','/media/oceans.mp4'); INSERT INTO sources VALUES('valid','live','https://media.example.test/real.mp4');");
      assert.deepEqual(removeDemoCatalogData(db), { removedSources: 1, removedTitles: 1 });
      assert.equal(db.prepare('SELECT id FROM media').get()?.id, 'live');
      assert.equal(db.prepare('SELECT id FROM sources').get()?.id, 'valid');
    } finally { db.close(); }
  });
  test('public discovery is available but anonymous administration is denied', async () => {
    assert.equal((await app.request('/api/v1/catalog?limit=10')).status, 200);
    assert.equal((await app.request('/api/v1/admin/system/status')).status, 401);
    assert.equal((await app.request('/api/v1/admin/sync', { method: 'POST' })).status, 401);
  });
  test('an empty catalog stays empty and never publishes demo records', async () => {
    for (const endpoint of ['/api/v1/catalog?limit=100', '/api/v1/movies/trending']) {
      const response = await app.request(endpoint);
      const body = await response.json();
      const items = Array.isArray(body) ? body : body.items;
      assert.ok(Array.isArray(items));
      assert.equal(items.some((item: any) => item.metadata_provenance === 'demo-seed'), false);
    }
  });
  test('registration hashes passwords and cannot assign admin privileges', async () => {
    const identity = await register('normal');
    const row = getDatabase().prepare('SELECT password_hash,role FROM users WHERE id=?').get(identity.user.id)!;
    assert.match(String(row.password_hash), /^scrypt\$/);
    assert.notEqual(row.password_hash, 'a-long-test-password');
    assert.equal(row.role, 'user');
    assert.equal((await app.request('/api/v1/admin/system/status', { headers: headers(identity) })).status, 403);
    const injected = await app.request('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'injected@example.test', password: 'a-long-test-password', role: 'admin' }) });
    assert.equal(injected.status, 400);
  });
  test('sign in verifies credentials and logout revokes the session', async () => {
    const identity = await register('login');
    const wrong = await app.request('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: identity.user.email, password: 'not-the-right-password' }) });
    assert.equal(wrong.status, 401);
    const login = await app.request('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: identity.user.email, password: 'a-long-test-password' }) });
    assert.equal(login.status, 200);
    const body = await login.json();
    const signed = { cookie: login.headers.get('set-cookie')!.split(';')[0], csrf: body.csrf, user: body.user };
    assert.equal((await app.request('/api/v1/auth/logout', { method: 'POST', headers: { Cookie: signed.cookie } })).status, 403);
    assert.equal((await app.request('/api/v1/auth/logout', { method: 'POST', headers: headers(signed) })).status, 200);
    assert.equal((await app.request('/api/v1/library', { headers: headers(signed) })).status, 401);
  });
  test('library mutations require CSRF and remain isolated between accounts', async () => {
    const first = await register('first'), second = await register('second');
    const item = { id: 'interstellar', title: 'Interstellar', type: 'movie' };
    assert.equal((await app.request('/api/v1/library/watchlist/interstellar', { method: 'PUT', headers: { Cookie: first.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(item) })).status, 403);
    assert.equal((await app.request('/api/v1/library/watchlist/interstellar', { method: 'PUT', headers: headers(first), body: JSON.stringify(item) })).status, 200);
    const firstLibrary = await (await app.request('/api/v1/library', { headers: headers(first) })).json();
    const secondLibrary = await (await app.request('/api/v1/library', { headers: headers(second) })).json();
    assert.equal(firstLibrary.watchlist.length, 1); assert.equal(secondLibrary.watchlist.length, 0);
    assert.equal((await app.request('/api/v1/library/watchlist/wrong-id', { method: 'PUT', headers: headers(first), body: JSON.stringify(item) })).status, 400);
  });
  test('configured sources are bound to a title and never create sample fallbacks', async () => {
    const identity = await register('operator');
    getDatabase().prepare("UPDATE users SET role='admin' WHERE id=?").run(identity.user.id);
    getDatabase().prepare('INSERT OR IGNORE INTO media(id,type,title,data) VALUES(?,?,?,?)').run('interstellar-test', 'movie', 'Interstellar', JSON.stringify({ id: 'interstellar-test', type: 'movie', title: 'Interstellar', metadata_provenance: 'test-fixture', availability: {} }));
    const title = getDatabase().prepare("SELECT id FROM media WHERE title='Interstellar'").get()!;
    const titleId = String(title.id);
    const source = { content_id: titleId, type: 'movie', url: '/media/playback.webm', name: 'Test source', format: 'webm', provenance: 'Encoded test media; not the film' };
    const added = await app.request('/api/v1/admin/sources', { method: 'POST', headers: headers(identity), body: JSON.stringify(source) });
    assert.equal(added.status, 201);
    const unavailable = await app.request('/api/v1/playback/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content_type: 'movie', content_id: 'unrelated-title' }) });
    assert.equal(unavailable.status, 409);
    const session = await app.request('/api/v1/playback/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content_type: 'movie', content_id: titleId }) });
    assert.equal(session.status, 201);
    const body = await session.json();
    assert.equal(body.stream_url, '/media/playback.webm'); assert.deepEqual(body.qualities, []); assert.deepEqual(body.subtitles, []);
    assert.equal((await app.request(`/api/v1/playback/movie/${titleId}/session?token=${body.token}`)).status, 200);
    assert.equal((await app.request(`/api/v1/playback/movie/unrelated-title/session?token=${body.token}`)).status, 403);
    const unknown = await (await app.request('/api/v1/vega/identity/unmapped-film')).json();
    assert.equal(unknown.imdbId, null);
    const wrongSources = await (await app.request('/api/v1/vega/streams/movie/unrelated-title')).json();
    assert.deepEqual(wrongSources.sources, []);
  });
  test('playback sessions bridge unconfigured titles to backend provider discovery', async () => {
    const unavailable = await app.request('/api/v1/playback/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content_type: 'movie', content_id: 'unrelated-title' }) });
    assert.equal(unavailable.status, 409);
    const badStreams = await app.request('/api/v1/playback/provider-streams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content_type: 'movie', content_id: 'unrelated-title', provider: 'castle' }) });
    assert.equal(badStreams.status, 404);
    const catalog = await (await app.request('/api/v1/catalog?limit=1')).json();
    const target = catalog.items?.[0];
    assert.ok(target?.id, 'catalog must supply a discoverable title for the session bridges');
    const providerResponse = await app.request('/api/v1/playback/provider-streams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content_type: target.type, content_id: target.id, provider: 'castle' }) });
    assert.ok([200, 503].includes(providerResponse.status), `unexpected provider-stream status ${providerResponse.status}`);
    const session = await app.request('/api/v1/playback/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content_type: target.type, content_id: target.id }) });
    assert.ok([201, 409, 503].includes(session.status), `unexpected session status ${session.status}`);
    if (session.status === 201) {
      const payload = await session.json();
      assert.ok(payload.session_id);
      assert.ok(payload.token);
      assert.ok(Array.isArray(payload.sources) && payload.sources.length > 0);
      assert.equal(payload.sources[0].content_id, target.id);
      const entitlement = await app.request(`/api/v1/playback/${target.type}/${target.id}/session?token=${encodeURIComponent(payload.token)}`);
      assert.equal(entitlement.status, 200);
      assert.deepEqual((await entitlement.json()).sources, payload.sources);
    }
  });
  test('unsafe media destinations and malformed requests are rejected', async () => {
    for (const url of ['javascript:alert(1)', 'http://example.test/video.mp4', 'https://localhost/video.mp4', 'https://10.0.0.1/video.mp4', 'https://user:secret@example.test/x', '/media/../private.mp4']) assert.equal(safeMediaUrl(url), false);
    assert.equal(safeMediaUrl('https://media.example.test/film.mp4'), true);
    assert.equal((await app.request('/api/v1/playback/session', { method: 'POST', body: '{}' })).status, 400);
    assert.equal((await app.request('/api/v1/catalog?limit=-1')).status, 400);
    assert.equal((await app.request('/api/v1/catalog?page=NaN')).status, 400);
    assert.equal((await app.request('/api/v1/catalog?min_year=2025&max_year=2000')).status, 400);
  });
  test('tokens without expiration and expired or tampered tokens are rejected', () => {
    assert.equal(verifyPlaybackToken(createPlaybackToken({ content_id: 'x' })), null);
    assert.equal(verifyPlaybackToken(createPlaybackToken({ exp: Math.floor(Date.now() / 1000) - 1 })), null);
    const token = createPlaybackToken({ exp: Math.floor(Date.now() / 1000) + 60 });
    assert.ok(verifyPlaybackToken(token));
    assert.equal(verifyPlaybackToken(token + 'tampered'), null);
  });
  test('password changes rotate the current session and revoke other sessions', async () => {
    const identity = await register('password-change');
    const second = await app.request('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: identity.user.email, password: 'a-long-test-password' }) });
    assert.equal(second.status, 200);
    const sessions = await (await app.request('/api/v1/auth/sessions', { headers: headers(identity) })).json();
    assert.equal(sessions.sessions.length, 2);
    const changed = await app.request('/api/v1/auth/password', { method: 'POST', headers: headers(identity), body: JSON.stringify({ current_password: 'a-long-test-password', new_password: 'a-new-long-test-password' }) });
    assert.equal(changed.status, 200);
    assert.equal((await app.request('/api/v1/library', { headers: { Cookie: second.headers.get('set-cookie')!.split(';')[0] } })).status, 401);
    assert.equal((await app.request('/api/v1/library', { headers: headers(identity) })).status, 401);
    const rotated = changed.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await app.request('/api/v1/library', { headers: { Cookie: rotated } })).status, 200);
  });
  test('health uses real database readiness and includes request correlation', async () => {
    const ready = await app.request('/ready');
    assert.equal(ready.status, 200); assert.equal((await ready.json()).database, 'connected');
    assert.ok(ready.headers.get('x-request-id')); assert.equal(ready.headers.get('x-content-type-options'), 'nosniff');
    for (const probe of ['/livez', '/startupz']) assert.equal((await app.request(probe)).status, 200);
    const metrics = await app.request('/metrics');
    assert.equal(metrics.status, 200);
    assert.match(metrics.headers.get('content-type') || '', /text\/plain/);
    assert.match(await metrics.text(), /movie_platform_latency_ms/);
    const snapshot = await (await app.request('/api/v1/metrics')).json();
    assert.ok(Number.isFinite(snapshot.latency_ms.p95));
    assert.ok(snapshot.requests_total > 0);
    const status = await (await app.request('/api/v1/status')).json();
    assert.ok(['operational', 'degraded'].includes(status.status));
  });
  test('data export and account deletion remove owned library and sessions', async () => {
    const identity = await register('delete');
    const exported = await (await app.request('/api/v1/auth/export', { headers: headers(identity) })).json();
    assert.equal(exported.user.id, identity.user.id); assert.equal(exported.user.password_hash, undefined);
    assert.equal((await app.request('/api/v1/auth/account', { method: 'DELETE', headers: headers(identity), body: JSON.stringify({ password: 'wrong' }) })).status, 403);
    assert.equal((await app.request('/api/v1/auth/account', { method: 'DELETE', headers: headers(identity), body: JSON.stringify({ password: 'a-long-test-password' }) })).status, 200);
    assert.equal(getDatabase().prepare('SELECT id FROM users WHERE id=?').get(identity.user.id), undefined);
    assert.equal((await app.request('/api/v1/library', { headers: headers(identity) })).status, 401);
  });
});
