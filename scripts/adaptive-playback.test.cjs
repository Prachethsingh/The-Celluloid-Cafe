const { test } = require('node:test');
const assert = require('node:assert/strict');

test('adaptive routing handles aliases and signed manifest URLs while preserving native HLS', async () => {
  const { requiresAdaptiveEngine } = await import('../apps/web/src/services/adaptivePlayback.js');
  const browser = { canPlayType: () => '' };
  for (const source of [
    { format: 'dash' }, { format: 'mpd' }, { format: 'hls' }, { format: 'm3u8' },
    { format: 'video', url: 'https://media.example/film.MPD?token=fixture' },
    { format: 'video', url: 'https://media.example/film.m3u8#fragment' },
  ]) assert.equal(requiresAdaptiveEngine(browser, source), true);
  assert.equal(requiresAdaptiveEngine(browser, { format: 'mp4', url: 'https://media.example/film.mp4' }), false);
  assert.equal(requiresAdaptiveEngine({ canPlayType: () => 'probably' }, { format: 'hls' }), false);
});

test('the adapter attaches, loads, reports real returned tracks and destroys once on abort', async () => {
  const { attachAdaptivePlayback } = await import('../apps/web/src/services/adaptivePlayback.js');
  const previousFetch = globalThis.fetch;
  const previousShaka = globalThis.shaka;
  const calls = [];
  let release;
  let pending = false;
  class PlayerFixture {
    static isBrowserSupported() { return true; }
    addEventListener() {}
    async attach() { calls.push('attach'); }
    async load(url) { calls.push(url); if (pending) await new Promise(resolve => { release = resolve; }); }
    getVariantTracks() { return [{ id: 4, height: 720 }, { id: 5, height: 0 }]; }
    async destroy() { calls.push('destroy'); }
  }
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ engine: 'shaka', available: true }) });
  globalThis.shaka = { Player: PlayerFixture, polyfill: { installAll() {} } };
  try {
    const controller = new AbortController();
    let tracks;
    const engine = await attachAdaptivePlayback({}, { url: '/fixture.mpd' }, { signal: controller.signal, onTracks: value => { tracks = value; }, onError: assert.fail });
    assert.deepEqual(tracks, [{ id: 4, height: 720 }]);
    controller.abort();
    await engine.destroy();
    assert.deepEqual(calls, ['attach', '/fixture.mpd', 'destroy']);
    calls.length = 0;
    pending = true;
    const aborted = new AbortController();
    const loading = attachAdaptivePlayback({}, { url: '/pending.mpd' }, { signal: aborted.signal, onTracks: assert.fail, onError: assert.fail });
    while (!release) await new Promise(resolve => setImmediate(resolve));
    aborted.abort();
    release();
    await assert.rejects(loading, { name: 'AbortError' });
    assert.deepEqual(calls, ['attach', '/pending.mpd', 'destroy']);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousShaka === undefined) delete globalThis.shaka;
    else globalThis.shaka = previousShaka;
  }
});
