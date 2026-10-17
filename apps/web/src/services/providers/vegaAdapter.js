import { API_BASE } from '../api';
import { executeVegaProvider } from '../vegaSandbox';
import { normalizeProviderStreams, safePlaybackUrl } from '../streamSources';

export function createVegaAdapter(id) {
  return {
    id, kind: 'vega',
    execute: (operation, input, options) => executeVegaProvider(id, operation, input, options),
    search: (query, options) => executeVegaProvider(id, 'search', { searchQuery: query, page: 1 }, options),
    getStreams: async (media, options = {}) => {
      const link = options.link || media.episode?.provider_link || media.provider_link;
      if (link) {
        try {
          const streams = normalizeProviderStreams(await executeVegaProvider(id, 'stream', { link, type: media.type, isDownload: false }, options), id, media);
          if (streams.length) return streams;
        } catch {
          options.signal?.throwIfAborted();
        }
      }
      // Recover when no provider link is cached, or the browser sandbox cannot
      // complete cookie/WebView-gated extraction: rerun the same provider on
      // the API host. This is what makes an explicit provider click resolve.
      const type = media.type === 'series' ? 'series' : 'movie';
      const response = await fetch(`${API_BASE}/playback/provider-streams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: media.id, content_type: type, provider: id, episode_id: media.episode?.id, season_number: media.episode?.season_number, episode_number: media.episode?.episode_number }),
        signal: options.signal,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) throw new Error(result?.diagnostics?.[0] || result?.error || `Backend ${id} lookup failed (${response.status})`);
      const sources = Array.isArray(result.sources) ? result.sources.filter(source => source && source.content_id === media.id && (source.episode_id || '') === (media.episode?.id || '') && safePlaybackUrl(source.url)) : [];
      if (!sources.length) throw new Error(result.diagnostics?.[0] || `${id}: no browser-playable source was returned for the selected provider title.`);
      return sources;
    },
  };
}
