import { Hono } from 'hono';
import { catalogItems } from '../services/database.js';
const movies = () => catalogItems().filter(item => item.type === 'movie');
const findMovie = (id: string) => movies().find(item => item.id === id);

export const moviesRouter = new Hono();

// GET /api/v1/movies/trending
moviesRouter.get('/trending', (c) => {
  const limit = Number(c.req.query('limit')) || 10;
  const trending = movies().filter(m => m.is_trending).slice(0, limit);
  return c.json(trending);
});

// GET /api/v1/movies/popular
moviesRouter.get('/popular', (c) => {
  const limit = Number(c.req.query('limit')) || 10;
  const sorted = movies().sort((a, b) => b.popularity - a.popularity).slice(0, limit);
  return c.json(sorted);
});

// GET /api/v1/movies/new
moviesRouter.get('/new', (c) => {
  const limit = Number(c.req.query('limit')) || 10;
  const newReleases = movies().filter(m => m.is_new || m.year >= 2023).slice(0, limit);
  return c.json(newReleases);
});

// GET /api/v1/movies/:id
moviesRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const movie = findMovie(id);
  if (!movie) {
    return c.json({ detail: 'Movie not found' }, 404);
  }
  return c.json(movie);
});

// GET /api/v1/movies/:id/availability
moviesRouter.get('/:id/availability', (c) => {
  const id = c.req.param('id');
  const country = (c.req.query('country') || 'US').toUpperCase();
  const movie = findMovie(id);
  if (!movie) {
    return c.json({ detail: 'Movie not found' }, 404);
  }
  const countryAvail = movie.availability_verified ? movie.availability?.[country] || [] : [];
  return c.json({
    movie_id: id,
    country,
    platforms: countryAvail,
  });
});
