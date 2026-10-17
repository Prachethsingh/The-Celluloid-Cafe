import { Hono } from 'hono';
import { z } from 'zod';
import { catalogItems } from '../services/database.js';

export const catalogRouter = new Hono();
const querySchema = z.object({ q: z.string().max(200).default(''), type: z.enum(['all', 'movie', 'series']).default('all'), genre: z.string().max(80).default('All'), language: z.string().max(50).default('All'), min_rating: z.coerce.number().min(0).max(10).default(0), min_year: z.coerce.number().int().min(1800).max(2200).default(1800), max_year: z.coerce.number().int().min(1800).max(2200).default(2200), platform: z.string().max(50).default('all'), country: z.string().regex(/^[A-Z]{2}$/).default('US'), sort: z.enum(['popularity', 'rating', 'year', 'title']).default('popularity'), page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict().refine(query => query.min_year <= query.max_year);
catalogRouter.get('/', c => {
  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: 'Invalid catalog filters' }, 400);
  const query = parsed.data;
  const q = query.q.trim().toLowerCase();
  let items = catalogItems().filter(item => {
    const year = item.year || Number(item.first_air_date?.slice(0, 4));
    const haystack = [item.title, item.director, item.creator, ...(item.genres || []), ...(item.cast || []).map((person: any) => person.name)].filter(Boolean).join(' ').toLowerCase();
    return (!q || haystack.includes(q)) && (query.type === 'all' || item.type === query.type) && (query.genre === 'All' || item.genres?.includes(query.genre)) && (query.language === 'All' || item.language?.toLowerCase() === query.language.toLowerCase()) && (!query.min_rating || Number(item.rating) >= query.min_rating) && (!year || (year >= query.min_year && year <= query.max_year)) && (query.platform === 'all' || (item.availability?.[query.country] || []).some((platform: any) => platform.platformId === query.platform && platform.available));
  });
  items.sort((a, b) => query.sort === 'title' ? a.title.localeCompare(b.title) : Number(b[query.sort] || 0) - Number(a[query.sort] || 0));
  const total = items.length;
  items = items.slice((query.page - 1) * query.limit, query.page * query.limit);
  return c.json({ items, total, page: query.page, limit: query.limit, has_more: query.page * query.limit < total });
});
