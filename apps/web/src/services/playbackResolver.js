import { API_BASE } from './api';
import { createVegaAdapter } from './providers/vegaAdapter';
import { createStremioAdapter, installedAddons } from './providers/stremioAdapter';

export { safePlaybackUrl, normalizeProviderStreams } from './streamSources';
import { safePlaybackUrl } from './streamSources';
import { readProviderList } from './providerPreferences';

export async function resolvePlayback(content, signal) {
  signal?.throwIfAborted();
  if (content.resolvedSources?.length) return { sources: content.resolvedSources.filter(source => source.content_id === content.id && safePlaybackUrl(source.url)), diagnostics: [] };
  if (content.addon_id) {
    const addon = installedAddons().find(entry => entry.id === content.addon_id);
    if (!addon) return { sources: [], diagnostics: ['This add-on connection was removed. Reconnect it before resuming playback.'] };
    const sources = await createStremioAdapter(addon).getStreams(content, { signal });
    return { sources, diagnostics: sources.length ? [] : ['The add-on returned no supported direct browser media for this title or episode.'] };
  }
  const type = content.type === 'series' ? 'series' : 'movie';
  if (type === 'series' && !content.episode?.id) return { sources: [], diagnostics: ['Choose a specific episode before requesting series playback.'] };
  const episode = content.episode?.id || '';
  const response = await fetch(`${API_BASE}/playback/sources/${type}/${encodeURIComponent(content.id)}?episode_id=${encodeURIComponent(episode)}`, { signal });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Playback access was denied. Sign in with an account permitted to access this source.' : 'The playback service is unavailable. Try again.');
  const configured = await response.json();
  if (Array.isArray(configured.sources) && configured.sources.length) {
    const sources = configured.sources.filter(source => source && source.content_id === content.id && (source.episode_id || '') === episode && safePlaybackUrl(source.url));
    if (sources.length) return { sources, diagnostics: [] };
  }

  const disabled = readProviderList('mp_disabled_vega_providers');
  let diagnostics = [];
  // Search provider modules on the API host, not in the user's browser.
  try {
    const discoverResponse = await fetch(`${API_BASE}/playback/discover-streams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id: content.id, content_type: type, episode_id: episode || undefined, season_number: content.episode?.season_number, episode_number: content.episode?.episode_number, disabled_providers: disabled, provider_order: readProviderList('mp_vega_provider_order') }),
      signal
    });
    if (discoverResponse.ok) {
      const discoverResult = await discoverResponse.json();
      if (Array.isArray(discoverResult.sources) || Array.isArray(discoverResult.providers)) {
        // Flatten all streams from all providers
        const allSources = Array.isArray(discoverResult.sources) ? discoverResult.sources : discoverResult.providers.flatMap(p => p.streams || []);
        const validSources = allSources.filter(s => s && s.content_id === content.id && (s.episode_id || '') === episode && safePlaybackUrl(s.url));
        if (validSources.length > 0) {
          return { sources: validSources, diagnostics: [] };
        }
      }
      diagnostics = discoverResult.diagnostics || [];
    } else if (discoverResponse.status !== 404) {
      throw new Error('Backend provider discovery is unavailable or busy. Retry shortly.');
    }
  } catch (e) {
    signal?.throwIfAborted();
    diagnostics = [e.message];
  }

  const providerLink = content.episode?.provider_link || content.provider_link;
  if (!providerLink || !content.provider) {
    return { sources: [], diagnostics: diagnostics.length ? diagnostics : ['No configured playback source is available for this title. Add an authorized, title-specific source or select a provider stream explicitly.'] };
  }

  if (disabled.includes(content.provider)) return { sources: [], diagnostics: [`${content.provider} is disabled. Enable it before requesting this selected stream.`] };
  try {
    const sources = await createVegaAdapter(content.provider).getStreams({ ...content, type }, { signal, link: providerLink });
    return { sources, diagnostics: sources.length ? [] : [`${content.provider}: no browser-playable source was returned for the selected provider title.`] };
  } catch (error) {
    signal?.throwIfAborted();
    return { sources: [], diagnostics: [`${content.provider}: ${error.message}`] };
  }
}

// Get next playable item in catalog
export async function getNextPlayable(content, signal, onChecking = () => {}) {
  if (content.type === 'series') return null;
  const response = await fetch(`${API_BASE}/playback/next-playable/movie/${encodeURIComponent(content.id)}`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load the next movie.');
  const result = await response.json();
  for (const candidate of result.candidates || (result.next ? [result.next] : [])) {
    signal?.throwIfAborted();
    onChecking(candidate);
    try {
      const resolved = await resolvePlayback(candidate, signal);
      if (resolved.sources.length) return { ...candidate, resolvedSources: resolved.sources };
    } catch {
      signal?.throwIfAborted();
      // An unavailable title must not prevent checking the remaining queue.
    }
  }
  return null;
}
