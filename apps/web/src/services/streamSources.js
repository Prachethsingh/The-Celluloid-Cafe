export function safePlaybackUrl(value) {
  if (typeof value !== 'string') return false;
  if (/^\/media\/[A-Za-z0-9_-]+\.(mp4|webm|vtt|m3u8|mpd)$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[|.*\.local$)/i.test(url.hostname);
  } catch { return false; }
}

export function normalizeProviderStreams(streams, provider, content) {
  if (!Array.isArray(streams)) return [];
  const seen = new Set();
  return streams.filter(stream => {
    if (!stream || !safePlaybackUrl(stream.link) || !['mp4', 'webm', 'm3u8', 'hls', 'mpd', 'dash', 'video'].includes(String(stream.type).toLowerCase()) || seen.has(stream.link)) return false;
    seen.add(stream.link); return true;
  }).map((stream, index) => ({
    id: `${provider}:${index}`, provider, content_id: content.id,
    episode_id: content.episode?.id || null, url: stream.link,
    name: typeof stream.server === 'string' ? stream.server : provider, format: String(stream.type).toLowerCase() === 'hls' ? 'm3u8' : String(stream.type).toLowerCase() === 'dash' ? 'mpd' : String(stream.type).toLowerCase(),
    quality: /^(2160|1440|1080|720|480|360)p?$|^4k$/i.test(String(stream.quality || '').trim()) ? String(stream.quality).trim() : null, provenance: `Original ${provider} stream module`,
    subtitles: (Array.isArray(stream.subtitles) ? stream.subtitles : []).filter(track => track && track.type === 'text/vtt' && safePlaybackUrl(track.uri)).map(track => ({ url: track.uri, label: track.title || track.language || 'Subtitles', language: track.language || 'und' })),
  }));
}
