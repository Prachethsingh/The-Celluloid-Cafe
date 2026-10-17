import { Hono } from 'hono';
import { catalogItems } from '../services/database.js';
const seriesItems = () => catalogItems().filter(item => item.type === 'series');
const findSeries = (id: string) => seriesItems().find(item => item.id === id);

export const seriesRouter = new Hono();

// GET /api/v1/series/trending
seriesRouter.get('/trending', (c) => {
  const limit = Number(c.req.query('limit')) || 10;
  const trending = seriesItems().filter(s => s.is_trending).slice(0, limit);
  return c.json(trending);
});

// GET /api/v1/series/:id
seriesRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const series = findSeries(id);
  if (!series) {
    return c.json({ detail: 'Series not found' }, 404);
  }
  return c.json(series);
});

// GET /api/v1/series/:id/seasons
seriesRouter.get('/:id/seasons', (c) => {
  const id = c.req.param('id');
  const series = findSeries(id);
  if (!series) {
    return c.json({ detail: 'Series not found' }, 404);
  }
  return c.json(series.seasons);
});
