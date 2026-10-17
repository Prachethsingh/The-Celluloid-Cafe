const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');

async function loadResolver(fetch) {
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../apps/web/src/services/playbackResolver.js')],
    bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{ name: 'fixtures', setup(build) {
      build.onResolve({ filter: /^\.\// }, args => args.importer.endsWith('playbackResolver.js') ? { path: args.path, namespace: 'fixture' } : undefined);
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
        export const API_BASE = '/api/v1';
        export const readProviderList = () => [];
        export const installedAddons = () => [];
        export const createVegaAdapter = () => { throw new Error('Unexpected browser discovery'); };
        export const createStremioAdapter = createVegaAdapter;
        export const safePlaybackUrl = url => typeof url === 'string' && url.startsWith('https://');
        export const normalizeProviderStreams = value => value;
      ` }));
    } }],
  });
  const module = { exports: {} };
  new Function('module', 'exports', 'fetch', result.outputFiles[0].text)(module, module.exports, fetch);
  return module.exports;
}
const response = body => ({ ok: true, status: 200, json: async () => body });

test('Play automatically requests backend discovery and accepts sources without reports', async () => {
  const calls = [];
  const source = { content_id: 'tt1234567', url: 'https://media.example/movie.mp4' };
  const resolver = await loadResolver(async (url, options) => {
    calls.push({ url, options });
    return response(calls.length === 1 ? { sources: [] } : { sources: [source] });
  });
  assert.deepEqual((await resolver.resolvePlayback({ id: source.content_id, type: 'movie' })).sources, [source]);
  assert.equal(calls[1].url, '/api/v1/playback/discover-streams');
  assert.equal(JSON.parse(calls[1].options.body).content_id, source.content_id);
});

test('next movie skips a failed lookup and keeps searching', async () => {
  const source = { content_id: 'next', url: 'https://media.example/next.mp4' };
  const resolver = await loadResolver(async url => {
    if (url.includes('next-playable')) return response({ candidates: [{ id: 'broken' }, { id: 'next' }] });
    if (url.includes('/broken?')) throw new Error('Host unavailable');
    return response({ sources: [source] });
  });
  const checked = [];
  const next = await resolver.getNextPlayable({ id: 'current', type: 'movie' }, undefined, item => checked.push(item.id));
  assert.deepEqual(checked, ['broken', 'next']);
  assert.equal(next.id, 'next');
  assert.deepEqual(next.resolvedSources, [source]);
});

test('cancelling next movie search does not continue the queue', async () => {
  const controller = new AbortController();
  const resolver = await loadResolver(async url => {
    if (url.includes('next-playable')) return response({ candidates: [{ id: 'first' }, { id: 'second' }] });
    controller.abort();
    controller.signal.throwIfAborted();
  });
  const checked = [];
  await assert.rejects(resolver.getNextPlayable({ id: 'current' }, controller.signal, item => checked.push(item.id)), { name: 'AbortError' });
  assert.deepEqual(checked, ['first']);
});