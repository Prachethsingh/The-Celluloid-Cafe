import { Hono } from 'hono';
import { catalogItems } from '../services/database.js';

export const recommendationsRouter = new Hono();

// GET /api/v1/recommendations
recommendationsRouter.get('/', (c) => {
  const limit = Number(c.req.query('limit')) || 10;
  const genre = c.req.query('genre');

  let list = catalogItems();
  if (genre) {
    list = list.filter(item => item.genres?.includes(genre));
  }

  // Score by rating and popularity
  const scored = list.map(item => ({
    id: item.id,
    content_type: item.type,
    title: item.title,
    poster_url: item.poster_url,
    rating: item.rating,
    year: item.year || Number(item.first_air_date?.slice(0, 4)) || null,
    score: (Number(item.rating) / 10) * 0.7 + (Number(item.popularity) / 100) * 0.3,
  })).sort((a, b) => b.score - a.score).slice(0, limit);

  return c.json(scored);
});

// GET /api/v1/recommendations/similar/:type/:id
recommendationsRouter.get('/similar/:type/:id', (c) => {
  const { type, id } = c.req.param();
  const list = catalogItems().filter(item => item.type === type);
  const target = list.find(item => item.id === id);

  if (!target) {
    return c.json([]);
  }

  const targetGenres = new Set(target.genres || []);
  const pool = list.filter(item => item.id !== id);

  const scored = pool.map(item => {
    let overlap = 0;
    for (const g of item.genres || []) {
      if (targetGenres.has(g)) overlap++;
    }
    return {
      id: item.id,
      content_type: item.type,
      title: item.title,
      poster_url: item.poster_url,
      rating: item.rating,
      overlap,
    };
  }).filter(x => x.overlap > 0).sort((a, b) => b.overlap - a.overlap).slice(0, 5);

  return c.json(scored);
});
