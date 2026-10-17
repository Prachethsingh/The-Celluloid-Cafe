import { Hono } from 'hono';
import { PLATFORMS, COUNTRIES } from '../data/platforms.js';

export const platformsRouter = new Hono();

// GET /api/v1/platforms
platformsRouter.get('/', (c) => {
  return c.json(PLATFORMS);
});

// GET /api/v1/platforms/countries
platformsRouter.get('/countries', (c) => {
  return c.json(COUNTRIES);
});
