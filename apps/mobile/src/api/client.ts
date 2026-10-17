/**
 * Mobile API Client for Unified Movie & Series Platform
 * Connects to the backend API (FastAPI or Node microservice)
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';
const API_ORIGIN = new URL(API_BASE_URL).origin;

export interface MovieItem {
  id: string;
  title: string;
  type?: 'movie' | 'series';
  description: string;
  rating: number;
  release_date?: string;
  first_air_date?: string;
  runtime?: string | number;
  language?: string;
  poster_url: string;
  backdrop_url: string;
  stream_url?: string;
  stream_url_webm?: string;
  authorized_playback?: boolean;
  genres?: string[];
  cast?: Array<{ name: string; role: string }>;
  seasons?: Array<{
    season_number: number;
    title: string;
    episodes: Array<{
      episode_number: number;
      title: string;
      runtime: string;
      description: string;
      thumbnail_url?: string;
    }>;
  }>;
  availability?: Record<string, Array<{ platform_id: string; name: string; available: boolean }>>;
}

export const fetchTrending = async (): Promise<MovieItem[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/movies/trending`);
    if (!res.ok) throw new Error('Failed to fetch trending');
    const data = await res.json();
    return data.items || data;
  } catch (err) {
    console.warn('API fetch trending fallback:', err);
    return [];
  }
};

export const fetchCatalog = async (): Promise<MovieItem[]> => {
  const items: MovieItem[] = [];
  for (let page = 1; page <= 100; page++) {
    const res = await fetch(`${API_BASE_URL}/catalog?limit=100&page=${page}`);
    if (!res.ok) throw new Error(`Catalog request failed (${res.status})`);
    const result = await res.json();
    items.push(...(Array.isArray(result.items) ? result.items : []));
    if (!result.has_more) return items;
  }
  throw new Error('Catalog exceeded the supported page limit');
};

export const fetchAvailability = async (id: string, country = 'US') => {
  try {
    const res = await fetch(`${API_BASE_URL}/movies/${id}/availability?country=${country}`);
    if (!res.ok) throw new Error('Failed to fetch availability');
    return await res.json();
  } catch (err) {
    console.warn('API fetch availability fallback:', err);
    return null;
  }
};

export const searchCatalog = async (query: string, filters: Record<string, string> = {}) => {
  try {
    const params = new URLSearchParams({ q: query, ...filters });
    const res = await fetch(`${API_BASE_URL}/search?${params.toString()}`);
    if (!res.ok) throw new Error('Search failed');
    return await res.json();
  } catch (err) {
    console.warn('API search fallback:', err);
    return { items: [], total: 0 };
  }
};

export const createPlaybackSession = async (contentId: string, contentType = 'movie', country = 'US') => {
  const res = await fetch(`${API_BASE_URL}/playback/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_id: contentId, content_type: contentType, country_code: country })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Playback request failed (${res.status})`);
  if (typeof data.stream_url !== 'string') throw new Error('The provider returned no playable media URL.');
  return { ...data, stream_url: new URL(data.stream_url, API_ORIGIN).toString() };
};
