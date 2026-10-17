import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/index.js';
import { getDatabase } from '../src/services/database.js';

const insertTestTitle = getDatabase().prepare('INSERT OR IGNORE INTO media(id,type,title,data) VALUES(?,?,?,?)');
for (const item of [
  { id: 'mov-1', type: 'movie', title: 'Test Movie', is_trending: true, year: 2024, genres: ['Drama'], availability_verified: true, availability: { US: [{ platformId: 'prime', platformName: 'Prime Video', available: true }] }, metadata_provenance: 'test-fixture' },
  { id: 'interstellar-test', type: 'movie', title: 'Interstellar', year: 2014, genres: ['Sci-Fi'], cast: [], availability: {}, metadata_provenance: 'test-fixture' }
]) insertTestTitle.run(item.id, item.type, item.title, JSON.stringify(item));

describe('Hono Movie Platform API Test Suite', () => {
  test('GET /health returns 200 with status ok', async () => {
    const res = await app.request('/health');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  test('GET /api/v1/movies/trending returns live database movies', async () => {
    const res = await app.request('/api/v1/movies/trending');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    assert.equal(body[0].type, 'movie');
  });

  test('GET /api/v1/movies/:id/availability returns country platforms', async () => {
    const res = await app.request('/api/v1/movies/mov-1/availability?country=US');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.movie_id, 'mov-1');
    assert.equal(body.country, 'US');
    assert.ok(Array.isArray(body.platforms));
  });

  test('GET /api/v1/search finds catalog titles with filters', async () => {
    const res = await app.request('/api/v1/search?q=interstellar');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    assert.equal(body[0].title, 'Interstellar');
  });

  test('unconfigured playback is unavailable instead of issuing a demo entitlement', async () => {
    const response = await app.request('/api/v1/playback/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: 'movie', content_id: 'no-configured-media', country_code: 'US' }),
    });
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, 'SOURCE_UNAVAILABLE');
    assert.equal(body.authorized, undefined);
    assert.equal(body.stream_url, undefined);
  });
});
