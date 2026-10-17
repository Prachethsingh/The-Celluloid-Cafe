import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import { providerBuildDirectory, appBuildDirectory } from '../services/repository.js';
import {
  getAllVegaProviders,
  getVegaManifestAndUrls,
  getVegaCatalog,
  getVegaMetadata,
  searchVega,
  resolveVegaStreams,
  resolveVegaIdentity,
  pingVegaProvider,
  scrapeSpecificVegaProvider,
  createVegaBackupPayload,
  validateAndRestoreVegaBackup
} from '../services/vegaProvider.js';

export const vegaRouter = new Hono();

vegaRouter.get('/identity/:id', c => {
  const id = c.req.param('id');
  if (id.length > 150) return c.json({ error: 'Invalid content identity' }, 400);
  return c.json({ content_id: id, imdbId: resolveVegaIdentity(id), provenance: 'catalog-identity-map' });
});

// The build artifacts come from the vendored sources, rather than a copied list.
vegaRouter.get('/build', (c) => {
  const readBuild = (directory: string) => {
    const manifest = path.join(directory, 'build-manifest.json');
    return fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : null;
  };
  return c.json({ providers: readBuild(providerBuildDirectory), app: readBuild(appBuildDirectory) });
});

vegaRouter.get('/runtime', (c) => {
  const filename = path.join(appBuildDirectory, 'sandbox-document.js');
  if (!fs.existsSync(filename)) return c.json({ error: 'Vega sandbox is not built. Run npm run build:vega-app.' }, 503);
  c.header('Content-Type', 'application/javascript; charset=utf-8');
  return c.body(fs.readFileSync(filename, 'utf8'));
});

vegaRouter.get('/providers/:provider/modules/:module', (c) => {
  const provider = c.req.param('provider');
  const module = c.req.param('module');
  if (!getAllVegaProviders().some(item => item.value === provider) || !['catalog', 'posts', 'meta', 'stream', 'episodes', 'settings'].includes(module)) {
    return c.json({ error: 'Provider module not found' }, 404);
  }
  const filename = path.join(providerBuildDirectory, provider, `${module}.js`);
  if (!fs.existsSync(filename)) return c.json({ error: 'Provider module is not built. Run npm run build:providers.' }, 404);
  c.header('Content-Type', 'application/javascript; charset=utf-8');
  return c.body(fs.readFileSync(filename, 'utf8'));
});

// GET /api/v1/vega/providers - Full manifest of Zenda-Cross providers (all 57)
vegaRouter.get('/providers', (c) => {
  const typeFilter = c.req.query('type') || undefined;
  const providers = getAllVegaProviders(typeFilter);
  const buildPath = path.join(providerBuildDirectory, 'build-manifest.json');
  const build = fs.existsSync(buildPath) ? JSON.parse(fs.readFileSync(buildPath, 'utf8')) : { providers: [] };
  return c.json({
    author: 'Zenda-Cross',
    repository: 'https://github.com/Zenda-Cross/vega-providers',
    count: providers.length,
    filter: typeFilter || 'all',
    providers: providers.map(provider => {
      const artifact = build.providers.find((entry: { value: string }) => entry.value === provider.value);
      const modules = (artifact?.modules || []).map((entry: { name: string }) => entry.name.replace(/\.js$/, ''));
      return { ...provider, modules, built: modules.includes('stream') && modules.every((module: string) => fs.existsSync(path.join(providerBuildDirectory, provider.value, module + '.js'))) };
    })
  });
});

// GET /api/v1/vega/manifest - Raw manifest.json from Zenda-Cross/vega-providers
vegaRouter.get('/manifest', (c) => {
  const { rawManifest } = getVegaManifestAndUrls();
  return c.json(rawManifest);
});

// GET /api/v1/vega/urls - Raw urls.json mirror mapping from Zenda-Cross/vega-providers
vegaRouter.get('/urls', (c) => {
  const { urlsMap } = getVegaManifestAndUrls();
  return c.json(urlsMap);
});

// GET /api/v1/vega/catalog - Fetch live catalog
vegaRouter.get('/catalog', async (c) => {
  const category = (c.req.query('category') || 'top_movies') as any;
  const items = await getVegaCatalog(category);
  return c.json({
    category,
    source: 'Zenda-Cross/vega-providers (Cinemeta)',
    count: items.length,
    items
  });
});

// GET /api/v1/vega/meta/:type/:id - Fetch live metadata & episodes
vegaRouter.get('/meta/:type/:id', async (c) => {
  const type = (c.req.param('type') || 'movie') as 'movie' | 'series';
  const id = c.req.param('id');
  const meta = await getVegaMetadata(type, id);
  if (!meta) {
    return c.json({ error: 'Metadata not found' }, 404);
  }
  return c.json({ meta });
});

// GET /api/v1/vega/search - Live Cinemeta search
vegaRouter.get('/search', async (c) => {
  const query = c.req.query('q') || '';
  const type = (c.req.query('type') || 'movie') as 'movie' | 'series';
  if (!query) {
    return c.json({ items: [] });
  }
  const items = await searchVega(query, type);
  return c.json({ query, type, count: items.length, items });
});

// GET /api/v1/vega/streams/:type/:id - Resolve streaming sources
vegaRouter.get('/streams/:type/:id', async (c) => {
  const type = (c.req.param('type') || 'movie') as 'movie' | 'series';
  const id = c.req.param('id');
  const season = c.req.query('season') ? parseInt(c.req.query('season')!, 10) : undefined;
  const episode = c.req.query('episode') ? parseInt(c.req.query('episode')!, 10) : undefined;
  const title = c.req.query('title') || undefined;

  const sources = await resolveVegaStreams(type, id, season, episode, title);
  return c.json({
    id,
    type,
    season,
    episode,
    count: sources.length,
    sources
  });
});

// GET /api/v1/vega/ping/:provider - Real-time ping latency test for provider
vegaRouter.get('/ping/:provider', async (c) => {
  const provider = c.req.param('provider');
  const result = await pingVegaProvider(provider);
  return c.json(result);
});

// GET /api/v1/vega/scrape/:provider/:type/:id - Direct targeted provider scraper execution
vegaRouter.get('/scrape/:provider/:type/:id', async (c) => {
  const provider = c.req.param('provider');
  const type = (c.req.param('type') || 'movie') as 'movie' | 'series';
  const id = c.req.param('id');
  const season = c.req.query('season') ? parseInt(c.req.query('season')!, 10) : undefined;
  const episode = c.req.query('episode') ? parseInt(c.req.query('episode')!, 10) : undefined;
  const title = c.req.query('title') || undefined;

  const result = await scrapeSpecificVegaProvider(provider, type, id, season, episode, title);
  return c.json(result);
});

// POST /api/v1/vega/backup/export - Export Vega App state backup (matching vega-app backup.ts)
vegaRouter.post('/backup/export', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const backup = createVegaBackupPayload(body);
  return c.json(backup);
});

// POST /api/v1/vega/backup/import - Import & validate Vega backup
vegaRouter.post('/backup/import', async (c) => {
  try {
    const body = await c.req.json();
    const result = validateAndRestoreVegaBackup(body);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});
