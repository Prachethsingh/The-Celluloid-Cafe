import { Hono } from 'hono';
import { catalogItems } from '../services/database.js';
import type { ContentItem } from '../types/index.js';

export const searchRouter = new Hono();

// GET /api/v1/search
searchRouter.get('/', (c) => {
  const q = (c.req.query('q') || '').toLowerCase().trim();
  const type = c.req.query('type'); // 'movie' | 'series' | undefined
  const genre = c.req.query('genre');
  const yearStr = c.req.query('year');
  const year = yearStr ? parseInt(yearStr, 10) : undefined;
  const language = c.req.query('language');
  const minRatingStr = c.req.query('min_rating');
  const minRating = minRatingStr ? parseFloat(minRatingStr) : undefined;
  const platform = c.req.query('platform');
  const country = (c.req.query('country') || 'US').toUpperCase();

  let results: ContentItem[] = catalogItems();

  if (q) {
    results = results.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchGenre = item.genres?.some(g => g.toLowerCase().includes(q));
      const matchCast = item.cast?.some(m => m.name.toLowerCase().includes(q));
      const directorOrCreator = 'director' in item ? item.director : item.creator;
      const matchDirector = directorOrCreator?.toLowerCase().includes(q);
      return matchTitle || matchGenre || matchCast || matchDirector;
    });
  }

  if (type && type !== 'all') {
    results = results.filter(item => item.type === type);
  }

  if (genre && genre !== 'All') {
    results = results.filter(item => item.genres?.includes(genre));
  }

  if (language && language !== 'All') {
    results = results.filter(item => item.language.toLowerCase() === language.toLowerCase());
  }

  if (year) {
    results = results.filter(item => {
      const itemYear = 'year' in item ? item.year : parseInt(item.first_air_date.slice(0, 4), 10);
      return itemYear === year;
    });
  }

  if (minRating) {
    results = results.filter(item => item.rating >= minRating);
  }

  if (platform && platform !== 'all') {
    results = results.filter(item => {
      const countryAvail = item.availability[country] || [];
      return countryAvail.some(p => p.platformId === platform && p.available);
    });
  }

  // Format to standard search response
  const mapped = results.map((item) => {
    const itemYear = 'year' in item ? item.year : parseInt(item.first_air_date.slice(0, 4), 10);
    const countryAvail = item.availability[country] || [];
    const availableOn = countryAvail.filter(p => p.available).map(p => p.platformName);

    return {
      id: item.id,
      content_type: item.type,
      title: item.title,
      year: itemYear,
      poster_url: item.poster_url,
      rating: item.rating,
      genres: item.genres,
      available_on: availableOn,
      match_score: 1.0,
    };
  });

  return c.json(mapped);
});

// GET /api/v1/search/suggestions
searchRouter.get('/suggestions', (c) => {
  const q = (c.req.query('q') || '').toLowerCase().trim();
  if (!q) return c.json([]);

  const suggestions: Array<{ id: string; title: string; type: string }> = [];
  for (const item of catalogItems()) {
    if (item.title.toLowerCase().includes(q)) {
      suggestions.push({ id: item.id, title: item.title, type: item.type });
    }
  }
  return c.json(suggestions.slice(0, 8));
});
