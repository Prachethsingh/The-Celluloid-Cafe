import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { prettyJSON } from 'hono/pretty-json';
import { serve } from '@hono/node-server';

import { moviesRouter } from './routes/movies.js';
import { seriesRouter } from './routes/series.js';
import { searchRouter } from './routes/search.js';
import { playbackRouter } from './routes/playback.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { platformsRouter } from './routes/platforms.js';
import { adminRouter } from './routes/admin.js';
import { vegaRouter } from './routes/vega.js';
import { authRouter } from './routes/auth.js';
import { libraryRouter } from './routes/library.js';
import { mediaRouter } from './routes/media.js';
import { catalogRouter } from './routes/catalog.js';
import { getDatabase, closeDatabase } from './services/database.js';
import { provisionAdmin } from './services/auth.js';
import { platformMiddleware, metricsSnapshot, prometheusMetrics } from './middleware/platform.js';
import { startCatalogSyncSchedule } from './services/catalogSync.js';

export const app = new Hono();

// Global Middlewares
app.use('*', platformMiddleware);
app.use('*', bodyLimit({ maxSize: 65536, onError: c => c.json({ error: 'Request body exceeds 64 KiB' }, 413) }));
app.use('*', prettyJSON());
app.use(
  '*',
  cors({
    origin: (origin) => (process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173').split(',').includes(origin) ? origin : undefined,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Requested-With'],
    exposeHeaders: ['Content-Length', 'Content-Type'],
    maxAge: 86400,
  })
);
app.onError((error, c) => {
  console.error(JSON.stringify({ event: 'http.error', request_id: c.res.headers.get('X-Request-ID'), name: error.name }));
  return c.json({ error: 'Unexpected server error', request_id: c.res.headers.get('X-Request-ID') }, 500);
});
app.get('/ready', c => {
  try { getDatabase().prepare('SELECT 1').get(); return c.json({ status: 'ready', database: 'connected' }); }
  catch { return c.json({ status: 'not-ready' }, 503); }
});
// Kubernetes probes: liveness = process alive, readiness = dependencies ready,
// startup = fully initialized (DB + catalog table present).
app.get('/livez', c => c.json({ status: 'alive', uptime_seconds: Math.round(process.uptime()) }));
app.get('/startupz', c => {
  try {
    getDatabase().prepare('SELECT COUNT(*) count FROM media').get();
    return c.json({ status: 'started' });
  } catch { return c.json({ status: 'starting' }, 503); }
});
// Prometheus metrics + JSON observability snapshot + public status page data.
app.get('/metrics', c => {
  c.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  return c.body(prometheusMetrics());
});
app.get('/api/v1/metrics', c => c.json(metricsSnapshot()));
app.get('/api/v1/status', c => {
  const metrics = metricsSnapshot();
  return c.json({
    status: metrics.error_rate < 0.05 ? 'operational' : 'degraded',
    uptime_seconds: metrics.uptime_seconds,
    error_rate: metrics.error_rate,
    latency_ms: metrics.latency_ms,
    incidents: [],
    maintenance_windows: [],
  });
});
app.route('/media', mediaRouter);

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'Movie Platform Hono API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount API v1 Routers
const api = new Hono();
api.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'Movie Platform Hono API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});
api.route('/movies', moviesRouter);
api.route('/series', seriesRouter);
api.route('/search', searchRouter);
api.route('/playback', playbackRouter);
api.route('/recommendations', recommendationsRouter);
api.route('/platforms', platformsRouter);
api.route('/admin', adminRouter);
api.route('/vega', vegaRouter);
api.route('/auth', authRouter);
api.route('/library', libraryRouter);
api.route('/catalog', catalogRouter);

app.route('/api/v1', api);

// Export for Bun and Cloudflare Workers
export default app;

// Auto-start for Node.js when run directly
const isTest = process.env.NODE_ENV === 'test' || process.argv.some(a => a.includes('test'));
const port = Number(process.env.PORT) || 8000;

if (!isTest && typeof process !== 'undefined' && process.release?.name === 'node') {
  await provisionAdmin();
  console.log(`🎬 Movie Platform Hono API server starting on http://localhost:${port}`);
  const server = serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`⚡ Hono API live at http://localhost:${info.port}`);
  });
  const catalogSyncTimer = startCatalogSyncSchedule();
  const shutdown = () => {
    const timeout = setTimeout(() => process.exit(1), 5000);
    timeout.unref();
    if (catalogSyncTimer) clearInterval(catalogSyncTimer);
    server.close(() => { clearTimeout(timeout); closeDatabase(); process.exit(0); });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
