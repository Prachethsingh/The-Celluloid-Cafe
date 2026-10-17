import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../src/index.js';
import { getVegaManifestAndUrls, getVegaCatalog, getVegaMetadata } from '../src/services/vegaProvider.js';
import { providerSourceDirectory } from '../src/services/repository.js';

describe('Vendored Vega integration', () => {
  test('title metadata cannot return artwork from a different identity', async () => {
    const originalFetch = globalThis.fetch;
    let meta = { id: 'tt1234567', name: 'Wrong record', type: 'movie' };
    globalThis.fetch = async () => new Response(JSON.stringify({ meta }));
    try {
      assert.equal(await getVegaMetadata('movie', 'tt0816692'), null);
      meta = { id: 'tt0816692', name: 'Interstellar', type: 'movie' };
      const record = await getVegaMetadata('movie', 'tt0816692');
      assert.equal(record?.imdb_id, 'tt0816692');
      assert.equal(record?.year, null); assert.equal(record?.poster_url, null);
    } finally { globalThis.fetch = originalFetch; }
  });
  test('upstream catalog preserves IDs and omits missing or invalid metadata', async () => {
    const originalFetch = globalThis.fetch;
    const offline = process.env.VEGA_OFFLINE;
    delete process.env.VEGA_OFFLINE;
    globalThis.fetch = async () => new Response(JSON.stringify({ metas: [
      { id: 'tt0816692', type: 'movie', name: 'Interstellar', poster: 'https://artwork.example.test/tt0816692.jpg' },
      { id: 'title-guess', type: 'movie', name: 'Unconfirmed title' },
      { id: 'tt1234567', type: 'movie', name: 'Record', imdbRating: 'invalid', poster: 'https://images.unsplash.com/stock.jpg' },
    ] }), { headers: { 'Content-Type': 'application/json' } });
    try {
      const records = await getVegaCatalog();
      assert.equal(records.length, 2);
      assert.equal(records[0].id, 'tt0816692');
      assert.equal(records[0].poster_url, 'https://artwork.example.test/tt0816692.jpg');
      assert.equal(records[0].year, null); assert.equal(records[0].rating, null);
      assert.equal(records[1].poster_url, null); assert.equal(records[1].rating, null);
      assert.equal(records[0].metadata_provenance, 'cinemeta');
    } finally { globalThis.fetch = originalFetch; if (offline === undefined) delete process.env.VEGA_OFFLINE; else process.env.VEGA_OFFLINE = offline; }
  });
  test('loads every provider from the vendored manifest regardless of working directory', async () => {
    const expected = JSON.parse(fs.readFileSync(path.join(providerSourceDirectory, 'manifest.json'), 'utf8'));
    const cwd = process.cwd();
    try {
      process.chdir(path.parse(cwd).root);
      assert.deepEqual(getVegaManifestAndUrls().rawManifest, expected);
      const response = await app.request('/api/v1/vega/providers');
      const body = await response.json();
      assert.equal(body.count, expected.length);
      assert.deepEqual(body.providers.map((provider: { value: string }) => provider.value), expected.map((provider: { value: string }) => provider.value));
    } finally { process.chdir(cwd); }
  });

  test('provider type filter uses the manifest categories', async () => {
    const response = await app.request('/api/v1/vega/providers?type=anime');
    const body = await response.json();
    assert.ok(body.providers.length > 0);
    assert.ok(body.providers.every((provider: { type: string }) => provider.type === 'anime'));
  });

  test('does not expose files outside the provider module allowlist', async () => {
    const unknown = await app.request('/api/v1/vega/providers/unknown/modules/stream');
    assert.equal(unknown.status, 404);
    const config = await app.request('/api/v1/vega/providers/vega/modules/package.json');
    assert.equal(config.status, 404);
  });
});
