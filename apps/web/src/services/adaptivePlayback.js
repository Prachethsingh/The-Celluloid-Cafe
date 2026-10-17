let runtime;
const missing = () => new Error('Adaptive playback is unavailable in this installation. Choose a direct MP4/WebM source or contact the operator.');

async function loadRuntime() {
  if (!runtime) runtime = (async () => {
    const response = await fetch('/vendor/player-manifest.json', { signal: AbortSignal.timeout(5000) });
    const manifest = await response.json().catch(() => null);
    if (!response.ok || !manifest?.available || manifest.engine !== 'shaka') throw missing();
    if (!globalThis.shaka) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/shaka-player.compiled.js';
      script.async = true;
      const timeout = setTimeout(() => { script.remove(); reject(missing()); }, 10000);
      script.onload = () => { clearTimeout(timeout); resolve(); };
      script.onerror = () => { clearTimeout(timeout); script.remove(); reject(missing()); };
      document.head.append(script);
    });
    const shaka = globalThis.shaka;
    if (!shaka?.Player || !shaka.polyfill) throw missing();
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) throw new Error('This browser does not support the adaptive playback engine.');
    return shaka;
  })().catch(reason => { runtime = null; throw reason; });
  return runtime;
}

export function requiresAdaptiveEngine(video, source) {
  const format = String(source.format || source.type || '').toLowerCase();
  const url = String(source.url || '').split(/[?#]/)[0];
  const dash = ['mpd', 'dash'].includes(format) || /\.mpd$/i.test(url);
  const hls = ['m3u8', 'hls'].includes(format) || /\.m3u8$/i.test(url);
  return dash || (hls && !video.canPlayType('application/vnd.apple.mpegurl'));
}

export async function attachAdaptivePlayback(video, source, { signal, onTracks, onError }) {
  const shaka = await loadRuntime();
  signal.throwIfAborted();
  const player = new shaka.Player();
  let destroyed = false;
  const destroy = async () => { if (destroyed) return; destroyed = true; signal.removeEventListener('abort', destroy); try { await player.destroy(); } catch { /* Teardown failures must not interrupt a source switch. */ } };
  signal.addEventListener('abort', destroy, { once: true });
  const tracks = () => { if (!signal.aborted) onTracks(player.getVariantTracks().filter(track => Number.isFinite(track.height) && track.height > 0)); };
  player.addEventListener('error', event => { if (!signal.aborted) onError(new Error(`Adaptive stream failed (code ${event.detail?.code || 'unknown'}). Check the source connection or try another source.`)); });
  player.addEventListener('trackschanged', tracks);
  try {
    await player.attach(video);
    signal.throwIfAborted();
    await player.load(source.url);
    signal.throwIfAborted();
    tracks();
    return { player, destroy };
  } catch (reason) { await destroy(); throw reason; }
}
