// API integration client for the live Movie Platform backend.

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

class ApiService {
  constructor() {
    this.user = null;
    this.csrf = null;
    this.country = localStorage.getItem('mp_country') || 'US';
    localStorage.removeItem('mp_token');
    localStorage.removeItem('mp_user');
  }

  async request(path, options = {}) {
    const response = await fetch(API_BASE + path, { cache: 'no-store', ...options, credentials: 'include', headers: { ...this.getHeaders(), ...options.headers } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Request failed (' + response.status + ')');
    return body;
  }

  async loadSession() {
    const session = await this.request('/auth/session');
    this.user = session.user; this.csrf = session.csrf;
    if (this.user) await this.syncLibrary();
    return this.user;
  }

  async authenticate(mode, email, password, displayName) {
    const data = await this.request('/auth/' + mode, { method: 'POST', body: JSON.stringify({ email, password, ...(mode === 'register' ? { display_name: displayName || email.split('@')[0] } : {}) }) });
    this.user = data.user; this.csrf = data.csrf;
    await this.syncLibrary();
    return this.user;
  }

  async signOut() {
    await this.request('/auth/logout', { method: 'POST' });
    this.user = null; this.csrf = null;
    localStorage.setItem('mp_watchlist', '[]');
    localStorage.setItem('mp_continue_watching', '[]');
  }

  async syncLibrary() {
    const library = await this.request('/library');
    localStorage.setItem('mp_watchlist', JSON.stringify(library.watchlist.map(item => item.id)));
    localStorage.setItem('mp_continue_watching', JSON.stringify(library.progress));
  }

  syncLibraryItem(kind, id, item) {
    if (!this.user) return;
    this.request('/library/' + kind + '/' + encodeURIComponent(id), { method: item ? 'PUT' : 'DELETE', ...(item ? { body: JSON.stringify(item) } : {}) }).catch(error => {
      window.dispatchEvent(new CustomEvent('library-sync-error', { detail: error.message }));
    });
  }

  setCountry(countryCode) {
    this.country = countryCode;
    localStorage.setItem('mp_country', countryCode);
  }

  getCountry() {
    return this.country;
  }

  getHeaders() {
    return { 'Content-Type': 'application/json', ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}) };
  }

  // --- CATALOG DISCOVERY ---
  async getTrending() {
    try {
      const res = await fetch(`${API_BASE}/movies/trending?limit=10`, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) return data;
      }
    } catch {}
    return [];
  }

  async getNewReleases() {
    try {
      const res = await fetch(`${API_BASE}/movies/new?limit=10`, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) return data;
      }
    } catch {}
    return [];
  }

  async getPopularSeries() {
    try {
      const res = await fetch(`${API_BASE}/series/trending?limit=10`, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) return data;
      }
    } catch {}
    return [];
  }

  async getAllContent() {
    const items = [];
    for (let page = 1; page <= 20; page++) {
      const result = await this.request('/catalog?limit=100&page=' + page);
      items.push(...result.items);
      if (!result.has_more) break;
    }
    return items;
  }

  // --- SEARCH & FILTER ---
  async searchPage(query = '', filters = {}, page = 1, signal) {
    const params = new URLSearchParams({ q: query, country: this.country, page: String(page), limit: '50' });
    const map = { type: 'type', genre: 'genre', language: 'language', platform: 'platform', minRating: 'min_rating', minYear: 'min_year', maxYear: 'max_year', sortBy: 'sort' };
    for (const [key, parameter] of Object.entries(map)) if (filters[key] !== undefined) params.set(parameter, String(filters[key]));
    return this.request('/catalog?' + params.toString(), { signal });
  }

  async search(query = '', filters = {}) { return (await this.searchPage(query, filters)).items; }

  // --- WATCHLIST ---
  getWatchlist() {
    const raw = localStorage.getItem('mp_watchlist');
    try { return raw ? JSON.parse(raw) : []; } catch { return []; }
  }

  toggleWatchlist(contentId, contentItem) {
    let list = this.getWatchlist();
    if (list.includes(contentId)) {
      list = list.filter(id => id !== contentId);
    } else {
      list.push(contentId);
    }
    localStorage.setItem('mp_watchlist', JSON.stringify(list));
    if (contentItem) this.syncLibraryItem('watchlist', contentId, list.includes(contentId) ? { ...contentItem, id: contentId } : null);
    return list;
  }

  // --- CONTINUE WATCHING & HISTORY ---
  getContinueWatching() {
    const raw = localStorage.getItem('mp_continue_watching');
    try { return raw ? JSON.parse(raw) : []; } catch { return []; }
  }

  updateProgress(contentId, { title, type, episode_title, episode_id, progress_seconds, duration_seconds, stream_url, poster_url, backdrop_url, provider, provider_link, provider_page_link, imdb_id, tmdb_id, episode, source_provider, addon_id, addon_media_id }) {
    let list = this.getContinueWatching();
    const percentage = duration_seconds > 0 ? Math.round((progress_seconds / duration_seconds) * 100) : 0;

    const existingIdx = list.findIndex(item => item.content_id === contentId && (item.episode_id || null) === (episode_id || null));
    const updatedEntry = {
      id: `cw_${contentId}_${Date.now()}`,
      content_id: contentId,
      episode_id: episode_id || null,
      title,
      type,
      episode_title: episode_title || null,
      progress_seconds,
      duration_seconds,
      percentage,
      poster_url,
      backdrop_url,
      stream_url,
        provider, provider_link, provider_page_link, imdb_id, tmdb_id, episode, source_provider,
        addon_id, addon_media_id,
      last_watched: 'Just now'
    };

    if (existingIdx >= 0) {
      list[existingIdx] = updatedEntry;
    } else {
      list.unshift(updatedEntry);
    }

    // Keep top 10
    list = list.slice(0, 10);
    localStorage.setItem('mp_continue_watching', JSON.stringify(list));
    this.syncLibraryItem('progress', contentId, { ...updatedEntry, id: contentId });
    return list;
  }

  removeFromContinueWatching(id) {
    const removed = this.getContinueWatching().find(item => item.id === id || item.content_id === id);
    let list = this.getContinueWatching().filter(item => item.id !== id && item.content_id !== id);
    localStorage.setItem('mp_continue_watching', JSON.stringify(list));
    if (removed) this.syncLibraryItem('progress', removed.content_id || removed.id, null);
    return list;
  }

  clearHistory() {
    for (const item of this.getContinueWatching()) this.syncLibraryItem('progress', item.content_id || item.id, null);
    localStorage.setItem('mp_continue_watching', '[]');
  }

  async createPlaybackSession(contentType, contentId, episodeId = null) {
    return this.request('/playback/session', { method: 'POST', body: JSON.stringify({ content_type: contentType, content_id: contentId, episode_id: episodeId }) });
  }

  async getSystemStatus() { return this.request('/admin/system/status'); }
  async triggerSync() { return this.request('/admin/sync', { method: 'POST' }); }

  // --- ZENDA-CROSS VEGA PROVIDERS & CINEMETA INTEGRATION ---
  async getVegaProviders(typeFilter = null) {
    try {
      const q = typeFilter ? `?type=${encodeURIComponent(typeFilter)}` : '';
      const res = await fetch(`${API_BASE}/vega/providers${q}`, { headers: this.getHeaders() });
      if (res.ok) return await res.json();
    } catch {}
    return {
      author: 'Zenda-Cross',
      repository: 'https://github.com/Zenda-Cross/vega-providers',
      providers: []
    };
  }

  async getVegaUrls() {
    try {
      const res = await fetch(`${API_BASE}/vega/urls`, { headers: this.getHeaders() });
      if (res.ok) return await res.json();
    } catch {}
    return {};
  }

  async getVegaCatalog(category = 'top_movies') {
    try {
      const res = await fetch(`${API_BASE}/vega/catalog?category=${category}`, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data?.items && data.items.length > 0) return data.items;
      }
    } catch {}
    return [];
  }

  async getVegaMetadata(type, id) {
    try {
      const res = await fetch(`${API_BASE}/vega/meta/${type}/${id}`, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        return data.meta;
      }
    } catch {}
    return null;
  }

  async getVegaStreams(type, id, season = null, episode = null, title = null) {
    try {
      const params = new URLSearchParams();
      if (season) params.append('season', season);
      if (episode) params.append('episode', episode);
      if (title) params.append('title', title);
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE}/vega/streams/${type}/${id}${q}`, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data?.sources && data.sources.length > 0) return data.sources;
      }
    } catch {}
    return [];
  }

  async searchVega(query, type = 'movie') {
    try {
      const res = await fetch(`${API_BASE}/vega/search?q=${encodeURIComponent(query)}&type=${type}`, { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        return data.items || [];
      }
    } catch {}
    return [];
  }

  async pingVegaProvider(providerKey) {
    try {
      const res = await fetch(`${API_BASE}/vega/ping/${providerKey}`, { headers: this.getHeaders() });
      if (res.ok) return await res.json();
    } catch {}
    return { provider: providerKey, status: 'offline', latencyMs: 0 };
  }

  async scrapeSpecificVegaProvider(providerKey, type, id, season = null, episode = null, title = null) {
    try {
      const params = new URLSearchParams();
      if (season) params.append('season', season);
      if (episode) params.append('episode', episode);
      if (title) params.append('title', title);
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE}/vega/scrape/${providerKey}/${type}/${id}${q}`, { headers: this.getHeaders() });
      if (res.ok) return await res.json();
    } catch {}
    return { provider: providerKey, success: false, streams: [] };
  }

  async exportVegaBackup(userData) {
    try {
      const res = await fetch(`${API_BASE}/vega/backup/export`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(userData)
      });
      if (res.ok) return await res.json();
    } catch {}
    return null;
  }

  async importVegaBackup(backupJson) {
    const res = await fetch(`${API_BASE}/vega/backup/import`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(backupJson)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to import backup');
    }
    return await res.json();
  }

}

export const api = new ApiService();
