import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase, catalogItems } from '../services/database.js';
import { requireAdmin, readSession, audit } from '../services/auth.js';
import { safeMediaUrl } from '../services/sources.js';
import { CatalogSyncInProgressError, synchronizeLiveCatalog } from '../services/catalogSync.js';
import { repositoryRoot } from '../services/repository.js';
import { getAllVegaProviders } from '../services/vegaProvider.js';

export const adminRouter = new Hono();
adminRouter.use('*', requireAdmin);

// GET /api/v1/admin/system/status
adminRouter.get('/system/status', (c) => {
  const items = catalogItems();
  const jobs = getDatabase().prepare('SELECT * FROM jobs ORDER BY started_at DESC LIMIT 10').all();
  const latestSync = getDatabase().prepare("SELECT finished_at FROM jobs WHERE kind='catalog-sync' AND status='completed' ORDER BY finished_at DESC LIMIT 1").get() as { finished_at: string } | undefined;
  return c.json({ movies_count: items.filter(item => item.type === 'movie').length, series_count: items.filter(item => item.type === 'series').length, episodes_count: items.reduce((sum, item) => sum + (item.seasons || []).reduce((total: number, season: any) => total + (season.episodes?.length || 0), 0), 0), catalog_last_synced_at: latestSync?.finished_at || null, services: { api: 'healthy', database: 'connected', cache: 'not configured' }, jobs, sources_count: getDatabase().prepare('SELECT count(*) count FROM sources').get()!.count });
});

// POST /api/v1/admin/sync
adminRouter.post('/sync', async c => {
  try {
    const result = await synchronizeLiveCatalog();
    audit(readSession(c)!.user.id, 'catalog.sync.complete', result.id);
    return c.json({ ...result, status: 'completed' });
  } catch (error) {
    if (error instanceof CatalogSyncInProgressError) return c.json({ error: error.message }, 409);
    audit(readSession(c)!.user.id, 'catalog.sync.failed', 'catalog-sync');
    return c.json({ error: 'Catalog synchronization failed; no records were changed' }, 502);
  }
});

const sourceSchema = z.object({ content_id: z.string().min(1).max(150), type: z.enum(['movie', 'series']), episode_id: z.string().max(150).default(''), url: z.string().max(2048).refine(safeMediaUrl), name: z.string().min(1).max(120), format: z.enum(['mp4', 'webm', 'm3u8', 'mpd']), provenance: z.string().min(1).max(500) }).strict();
adminRouter.get('/sources', c => c.json({ sources: getDatabase().prepare('SELECT * FROM sources ORDER BY created_at DESC LIMIT 200').all() }));
adminRouter.post('/sources', async c => {
  const parsed = sourceSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid title source. Provide an HTTPS/media URL, format, and provenance.' }, 400);
  const source = parsed.data;
  if (!getDatabase().prepare('SELECT id FROM media WHERE id=? AND type=?').get(source.content_id, source.type)) return c.json({ error: 'Choose a title from the catalog' }, 404);
  if (source.type === 'series' && !source.episode_id) return c.json({ error: 'Series sources require an episode identity' }, 400);
  const id = randomUUID();
  getDatabase().prepare('INSERT INTO sources VALUES(?,?,?,?,?,?,?,?,?)').run(id, source.content_id, source.type, source.episode_id, source.url, source.name, source.format, source.provenance, new Date().toISOString());
  audit(readSession(c)!.user.id, 'source.create', id);
  return c.json({ id, ...source }, 201);
});
adminRouter.delete('/sources/:id', c => {
  const result = getDatabase().prepare('DELETE FROM sources WHERE id=?').run(c.req.param('id'));
  if (!result.changes) return c.notFound();
  audit(readSession(c)!.user.id, 'source.delete', c.req.param('id'));
  return c.json({ success: true });
});
adminRouter.get('/audit', c => c.json({ events: getDatabase().prepare('SELECT * FROM audit ORDER BY created_at DESC LIMIT 100').all() }));

// Install every vendored third-party scraper module on the backend.
// These are code bundles that request streams from upstream sites at playback
// time; installing them means compiled, integrity-checked modules plus their
// URL configuration are present and reported per provider.
function providerInstallReport() {
  const buildManifest = path.join(repositoryRoot, '.build/vega-providers/build-manifest.json');
  const build = fs.existsSync(buildManifest) ? JSON.parse(fs.readFileSync(buildManifest, 'utf8')) : { providers: [] };
  const urlsPath = path.join(repositoryRoot, '.build/vega-providers/urls.json');
  const urls = fs.existsSync(urlsPath) ? JSON.parse(fs.readFileSync(urlsPath, 'utf8')) : {};
  return getAllVegaProviders().map(provider => {
    const artifact = build.providers.find((entry: { value: string }) => entry.value === provider.value);
    const modules = (artifact?.modules || []).map((entry: { name: string }) => entry.name.replace(/\.js$/, ''));
    const built = modules.includes('stream') && modules.every((module: string) =>
      fs.existsSync(path.join(repositoryRoot, '.build/vega-providers', provider.value, `${module}.js`)));
    return {
      value: provider.value, name: provider.name, type: provider.type,
      installed: built, modules,
      upstream_url: provider.url || urls[provider.value]?.url || null,
      upstream_disabled: !!provider.disabled,
    };
  });
}

adminRouter.get('/providers/install', c => {
  const providers = providerInstallReport();
  return c.json({
    installed: providers.filter(provider => provider.installed).length,
    total: providers.length,
    missing: providers.filter(provider => !provider.installed).map(provider => provider.value),
    providers,
  });
});

adminRouter.post('/providers/install-all', async c => {
  const { spawn } = await import('node:child_process');
  const build = await new Promise<{ ok: boolean; output: string }>(resolve => {
    const child = spawn(process.execPath, [path.join(repositoryRoot, 'scripts/build-providers.cjs')], { cwd: repositoryRoot });
    let output = '';
    child.stdout?.on('data', chunk => { output += String(chunk); });
    child.stderr?.on('data', chunk => { output += String(chunk); });
    child.once('error', error => resolve({ ok: false, output: output + String(error) }));
    child.once('exit', code => resolve({ ok: code === 0, output }));
  });
  const providers = providerInstallReport();
  const installed = providers.filter(provider => provider.installed);
  audit(readSession(c)!.user.id, 'providers.install-all', `${installed.length}/${providers.length}`);
  return c.json({
    build_ok: build.ok, build_output: build.output.slice(-2000),
    installed: installed.length, total: providers.length,
    missing: providers.filter(provider => !provider.installed).map(provider => provider.value),
    providers,
  }, build.ok && installed.length === providers.length ? 200 : 502);
});
