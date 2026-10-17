const { test: base, expect } = require('@playwright/test');
const { createHash } = require('node:crypto');

const test = base.extend({
  noPageErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use();
    expect(errors).toEqual([]);
  }, { auto: true }],
});

async function search(page, title = 'Interstellar') {
  await page.getByRole('button', { name: 'Search', exact: true }).first().click();
  await page.locator('.search-main-input').fill(title);
  const card = page.locator('.content-card').filter({ hasText: title }).first();
  await expect(card).toBeVisible();
  return card;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.content-card').first()).toBeVisible();
});

test('search separates pending, failed, retry and empty states', async ({ page }) => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let attempts = 0;
  await page.route('**/api/v1/catalog?**', async route => {
    if (!new URL(route.request().url()).searchParams.has('q')) return route.continue();
    attempts += 1;
    if (attempts === 1) {
      await pending;
      return route.fulfill({ status: 503, json: { error: 'Catalog temporarily unavailable' } });
    }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Search', exact: true }).first().click();
  await expect(page.getByText('Searching the collection…')).toBeVisible();
  await expect(page.getByText('No movies or series found')).toHaveCount(0);
  release();
  await expect(page.getByRole('button', { name: 'Retry search' })).toBeVisible();
  await expect(page.getByText('No movies or series found')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry search' }).click();
  await expect(page.locator('.search-results-section .content-card').first()).toBeVisible();
  await page.locator('.search-main-input').fill('no-such-title-xyz-2026');
  await expect(page.getByText('No movies or series found')).toBeVisible();
});

test('poster actions remain visible when focused and expose saved state', async ({ page }) => {
  const card = page.locator('.content-card').first();
  const play = card.locator('.card-play-btn');
  await play.focus();
  await expect(card.locator('.card-poster-overlay')).toHaveCSS('opacity', '1');
  const save = card.locator('.card-watchlist-btn');
  await expect(save).toHaveAttribute('aria-pressed', 'false');
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', 'true');
});

test('live titles show unknown artwork and availability without demo claims', async ({ page }) => {
  await expect(page.locator('.catalog-grid .rating-pill')).toHaveCount(0);
  await expect(page.locator('img[src*="unsplash.com"]')).toHaveCount(0);
  await expect(page.locator('.card-artwork').first()).toHaveAttribute('data-artwork-state', 'missing');
  const card = await search(page);
  await card.getByRole('button', { name: /^Details for/ }).click();
  await expect(page.getByText('Demo title record.', { exact: false })).toHaveCount(0);
  await expect(page.locator('.avail-grid')).toContainText('No verified service availability');
  await expect(page.getByText('Availability verified daily', { exact: false })).toHaveCount(0);
});

test('failed title artwork uses a contained fallback without broken image text', async ({ page }) => {
  await page.route('https://artwork.example.test/**', route => route.fulfill({ status: 404, body: '' }));
  await page.route('**/api/v1/catalog?**', async route => {
    if (!new URL(route.request().url()).searchParams.has('q')) return route.continue();
    return route.fulfill({ json: { items: [{ id: 'tt1234567', title: 'A very long title that must remain contained inside its own poster and metadata area', type: 'movie', year: 2020, genres: ['Drama'], poster_url: 'https://artwork.example.test/title.jpg', metadata_provenance: 'cinemeta' }], total: 1, page: 1, has_more: false } });
  });
  await page.getByRole('button', { name: 'Search', exact: true }).first().click();
  const artwork = page.locator('.search-results-section .card-artwork');
  await expect(artwork).toHaveAttribute('data-artwork-state', 'failed');
  await expect(artwork.locator('img')).toHaveCount(0);
  const bounds = await artwork.boundingBox();
  const fallback = await artwork.locator('.artwork-fallback strong').boundingBox();
  expect(fallback.x).toBeGreaterThanOrEqual(bounds.x);
  expect(fallback.x + fallback.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  expect(fallback.y + fallback.height).toBeLessThanOrEqual(bounds.y + bounds.height);
});

test('API health is reachable through the frontend proxy', async ({ request }) => {
  const response = await request.get('/api/v1/health');
  expect(response.ok()).toBe(true);
  expect((await response.json()).status).toBe('ok');
});

test('catalog renders and fits the viewport', async ({ page }) => {
  await expect(page).toHaveTitle(/CinePulse/i);
  expect(await page.locator('.content-card').count()).toBeGreaterThanOrEqual(15);
  const dimensions = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.width);
});

test('scan fixes provide metadata, keyboard bypass, image sizes and accessible targets', async ({ page }) => {
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(new URL(canonical).pathname).toBe('/');
  for (const property of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
    expect(await page.locator(`meta[property="${property}"]`).getAttribute('content')).toBeTruthy();
  }
  const socialImage = await page.request.get(new URL(await page.locator('meta[property="og:image"]').getAttribute('content')).pathname);
  expect(socialImage.ok()).toBe(true);
  expect(socialImage.headers()['content-type']).toContain('image/png');
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(schema['@graph'][0]['@type']).toBe('WebApplication');
  for (const question of schema['@graph'][1].mainEntity) {
    const entry = page.locator('.site-information details').filter({ hasText: question.name });
    await expect(entry).toContainText(question.acceptedAnswer.text);
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  expect(await page.locator('img:not([width]),img:not([height])').count()).toBe(0);
  for (const button of await page.locator('.flx-indicator-dot,.flx-top5-tab').all()) {
    const bounds = await button.boundingBox();
    if (bounds) { expect(bounds.width).toBeGreaterThanOrEqual(24); expect(bounds.height).toBeGreaterThanOrEqual(24); }
  }
  const ratios = await page.locator('.platform-pill-text').evaluateAll(elements => {
    const luminance = rgb => {
      const channels = rgb.map(value => { const n = value / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const parse = color => color.match(/[\d.]+/g).map(Number);
    return elements.map(element => {
      const layers = []; let current = element;
      while (current) { layers.unshift(parse(getComputedStyle(current).backgroundColor)); current = current.parentElement; }
      let background = [255, 255, 255];
      for (const color of layers) { const alpha = color[3] ?? 1; background = background.map((channel, index) => color[index] * alpha + channel * (1 - alpha)); }
      const foreground = parse(getComputedStyle(element).color).slice(0, 3);
      const a = luminance(foreground); const b = luminance(background);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
  });
  expect(ratios.length).toBeGreaterThan(0);
  expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
});

test('search, metadata, availability, and empty results', async ({ page }) => {
  const card = await search(page);
  await card.getByRole('button', { name: /^Details for/ }).click();
  const modal = page.locator('.modal-backdrop').first();
  await expect(modal).toContainText('Interstellar');
  await expect(modal).toContainText('Sci-Fi');
  await expect(modal.locator('.avail-grid')).toBeVisible();
  await modal.locator('.modal-close-btn').click();
  await page.locator('.search-main-input').fill('zznonexistentqa987654');
  await expect(page.getByRole('heading', { name: 'No movies or series found' })).toBeVisible();
});

test('country change updates selection and survives reload', async ({ page }) => {
  await (await search(page)).getByRole('button', { name: /^Details for/ }).click();
  await page.locator('.modal-country-select').selectOption('IN');
  await expect(page.locator('.modal-country-select')).toHaveValue('IN');
  expect(await page.evaluate(() => localStorage.getItem('mp_country'))).toBe('IN');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await (await search(page)).getByRole('button', { name: /^Details for/ }).click();
  await expect(page.locator('.modal-country-select')).toHaveValue('IN');
});

test('watchlist add, reload, and remove', async ({ page }) => {
  await (await search(page)).getByRole('button', { name: /^Details for/ }).click();
  const modal = page.locator('.modal-backdrop').first();
  const button = modal.getByRole('button', { name: /Watchlist/ });
  if ((await button.textContent()).includes('Saved')) await button.click();
  await button.click();
  await expect(button).toContainText('Saved');
  await modal.locator('.modal-close-btn').click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.content-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Library', exact: true }).first().click();
  const card = page.locator('.content-card').filter({ hasText: 'Interstellar' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /^Details for/ }).click();
  await modal.getByRole('button', { name: /Watchlist/ }).click();
  await modal.locator('.modal-close-btn').click();
  await expect(card).toHaveCount(0);
});

test('profile opens from the appropriate navigation', async ({ page, isMobile }) => {
  if (isMobile) await page.getByRole('navigation', { name: 'Mobile Navigation' }).getByRole('button', { name: 'Profile' }).click();
  else await page.getByRole('button', { name: 'User Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Account & Privacy' })).toBeVisible();
});

test('all bundled providers are available and admin renders', async ({ page, request }) => {
  const response = await request.get('/api/v1/vega/build');
  expect(response.ok()).toBe(true);
  const build = await response.json();
  const manifest = await (await request.get('/api/v1/vega/manifest')).json();
  expect(build.providers.providers.map(provider => provider.value)).toEqual(manifest.map(provider => provider.value));
  const module = await request.get('/api/v1/vega/providers/vega/modules/catalog');
  expect(module.ok()).toBe(true);
  expect(module.headers()['content-type']).toContain('application/javascript');
  await page.getByRole('button', { name: 'Vega Providers' }).click();
  await expect(page.locator('.vega-modal')).toContainText(`${manifest.length} Providers Loaded`);
  await page.locator('.vega-modal .modal-close-btn').click();
  await page.getByRole('button', { name: 'Admin Dashboard' }).click();
  await expect(page.locator('.admin-view-container')).toContainText('Sign in with an administrator');
  await expect(page.getByRole('alert')).toContainText('Sign in required');
});

test('every provider module is served with its recorded integrity', async ({ request, isMobile }) => {
  test.skip(isMobile, 'Module serving is independent of viewport size.');
  const build = await (await request.get('/api/v1/vega/build')).json();
  const registry = await (await request.get('/api/v1/vega/providers')).json();
  expect(registry.providers).toHaveLength(build.providers.providers.length);
  expect(registry.providers.every(provider => provider.built)).toBe(true);
  const modules = build.providers.providers.flatMap(provider => provider.modules.map(module => ({ provider: provider.value, ...module })));
  for (let offset = 0; offset < modules.length; offset += 12) {
    await Promise.all(modules.slice(offset, offset + 12).map(async module => {
      const response = await request.get(`/api/v1/vega/providers/${module.provider}/modules/${module.name.replace(/\.js$/, '')}`);
      expect(response.ok()).toBe(true);
      expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(module.sha256);
    }));
  }
});

test('provider browsing binds a selected dynamic episode to decoded playback', async ({ page }) => {
  const meta = { title: 'Provider regression series', type: 'series', synopsis: 'Controlled integration fixture.', imdbId: '', linkList: [{ title: 'Season 2', episodesLink: 'https://fixture.example/season-2' }] };
  const modules = {
    posts: `module.exports={getPosts:async()=>[{title:'Provider regression series',link:'https://fixture.example/series',image:''}],getSearchPosts:async()=>[{title:'Provider regression series',link:'https://fixture.example/series',image:''}]};`,
    meta: `module.exports={getMeta:async()=>(${JSON.stringify(meta)})};`,
    episodes: `module.exports={getEpisodes:async()=>[{title:'Episode 4',link:'https://fixture.example/season-2/episode-4'}]};`,
    stream: `module.exports={getStream:async({link,type})=>link==='https://fixture.example/season-2/episode-4'&&type==='series'?[{server:'Provider integration fixture',type:'webm',link:'/media/playback.webm'}]:[]};`,
  };
  for (const [module, body] of Object.entries(modules)) await page.route(`**/vega/providers/vega/modules/${module}`, route => route.fulfill({ contentType: 'application/javascript', body }));
  await page.getByRole('button', { name: 'Vega Providers' }).click();
  await page.getByRole('button', { name: 'Browse provider titles', exact: true }).click();
  const browser = page.getByRole('region', { name: 'Browse provider titles' });
  const registry = await (await page.request.get('/api/v1/vega/providers')).json();
  await expect(browser.getByRole('combobox', { name: 'Browse provider' }).locator('option')).toHaveCount(registry.count);
  await browser.getByRole('button', { name: 'Load categories' }).click();
  await expect(browser.getByRole('combobox', { name: 'Provider category' })).toContainText('Netflix');
  await browser.getByRole('button', { name: 'Browse titles', exact: true }).click();
  await browser.getByRole('button', { name: 'Provider regression series', exact: true }).click();
  await browser.getByRole('button', { name: 'Load episodes for Season 2' }).click();
  await browser.getByRole('button', { name: 'Play Episode 4' }).click();
  const video = page.locator('video'); await expect(video).toBeVisible();
  await video.evaluate(element => element.play());
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Close Player' }).click();
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('mp_continue_watching'))[0]);
  expect(progress.provider).toBe('vega');
  expect(progress.provider_link).toBe('https://fixture.example/season-2/episode-4');
  expect(progress.episode.title).toBe('Episode 4');
});

test('library uses recorded completion and restores local records only after confirmation', async ({ page, request }) => {
  const catalog = await (await request.get('/api/v1/catalog?q=Interstellar')).json();
  const title = catalog.items.find(item => item.title === 'Interstellar');
  await page.evaluate(item => {
    localStorage.setItem('mp_watchlist', JSON.stringify([item.id]));
    localStorage.setItem('mp_continue_watching', JSON.stringify([{ id: 'progress-fixture', content_id: item.id, title: item.title, type: 'movie', percentage: 95, progress_seconds: 95, duration_seconds: 100 }]));
  }, title);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto('/#library');
  await page.getByRole('button', { name: /^Completed/ }).click();
  await expect(page.locator('.content-card').filter({ hasText: 'Interstellar' })).toBeVisible();
  await page.getByRole('button', { name: 'Backup', exact: true }).click();
  await page.getByRole('textbox', { name: 'Library backup JSON' }).fill(JSON.stringify({ version: 1, data: { watchlist: [], continueWatching: [], providerOrder: [] } }));
  const restore = page.getByRole('button', { name: 'Validate & Restore Library' });
  await expect(restore).toBeDisabled();
  await page.getByRole('checkbox', { name: /Replace this device/ }).check();
  await restore.click();
  await expect(page.getByRole('status').filter({ hasText: 'Backup restored successfully' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mp_watchlist')))).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mp_continue_watching')))).toEqual([]);
});

test('native video decodes and time advances', async ({ page }) => {
  const supportsFixture = await page.evaluate(() => !!document.createElement('video').canPlayType('video/webm; codecs="vp8"'));
  test.skip(!supportsFixture, 'This browser installation has no VP8 video decoder');
  await (await search(page)).locator('.card-play-btn').click();
  const video = page.locator('video.main-html-video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate(async element => { element.muted = true; element.loop = true; await element.play(); });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.2);
  await expect(page.locator('.player-session-badge')).toContainText('Playing');
  await expect(page.locator('.player-session-badge')).not.toContainText('Ready');
  expect(await video.evaluate(element => ({ error: element.error, paused: element.paused, srcObject: !!element.srcObject, width: element.videoWidth }))).toEqual({ error: null, paused: false, srcObject: false, width: 320 });
  await page.getByRole('button', { name: 'Close Player' }).click();
  await expect(page.locator('.player-container')).toHaveCount(0);
});

test('upstream Vega sandbox executes the original provider catalog', async ({ page }) => {
  await page.getByRole('button', { name: 'Vega Providers' }).click();
  await page.getByRole('button', { name: 'Scraper Sandbox Runner' }).click();
  await page.getByLabel('Provider', { exact: true }).selectOption('vega');
  await page.getByLabel('Provider operation').selectOption('catalog');
  await page.getByRole('button', { name: 'Run Scraper' }).click();
  await expect(page.locator('.vega-modal pre')).toContainText('web-series/netflix', { timeout: 15000 });
  await expect(page.locator('.vega-modal pre')).toContainText('Amazon Prime');
});

test('unconfigured titles do not trigger automatic provider scraping or placeholder playback', async ({ page }) => {
  const automaticResolverCalls = [];
  const catalogResponse = await page.request.get('/api/v1/catalog?q=Test%20Catalog%20Film%2001');
  expect((await catalogResponse.json()).items).toContainEqual(expect.objectContaining({ title: 'Test Catalog Film 01' }));
  page.on('request', request => {
    const url = new URL(request.url());
    if (/\/api\/v1\/vega\/(identity|streams|scrape)/.test(url.pathname)) automaticResolverCalls.push(url.pathname);
  });
  await page.route('**/playback/sources/movie/**', route => route.fulfill({ json: { sources: [], status: 'unavailable' } }));
  await (await search(page, 'Test Catalog Film 01')).locator('.card-play-btn').click();
  await expect(page.locator('.player-session-badge')).toContainText('No source available');
  await expect(page.locator('video')).toHaveCount(0);
  expect(automaticResolverCalls).toEqual([]);
});

test('failed video displays an error instead of synthetic playback', async ({ page }) => {
  await page.route('**/media/playback.webm', route => route.fulfill({ contentType: 'video/webm', body: 'invalid-media' }));
  await (await search(page)).locator('.card-play-btn').click();
  await expect(page.getByRole('alert')).toContainText('This stream could not be played');
  await expect(page.locator('.player-session-badge')).toContainText('Playback failed');
  await expect(page.locator('.player-session-badge')).not.toContainText('Ready');
  await page.unroute('**/media/playback.webm');
  await page.getByRole('button', { name: 'Retry sources' }).click();
  await expect.poll(() => page.locator('video.main-html-video').evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.locator('video').evaluate(element => !!element.srcObject)).toBe(false);
});

test('real registration persists an account library and signs out', async ({ page }) => {
  await page.getByRole('button', { name: 'User Profile' }).isVisible().then(async visible => {
    if (visible) await page.getByRole('button', { name: 'User Profile' }).click();
    else await page.getByRole('navigation', { name: 'Mobile Navigation' }).getByRole('button', { name: 'Profile' }).click();
  });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Display name').fill('Browser test viewer');
  await page.getByLabel('Email address').fill(`browser-${crypto.randomUUID()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('a-long-browser-test-password');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Signed in as');
  await page.getByRole('button', { name: 'Close modal' }).click();
  const card = await search(page);
  await card.getByRole('button', { name: /^Details for/ }).click();
  const sync = page.waitForResponse(response => response.url().includes('/library/watchlist/') && response.request().method() === 'PUT');
  await page.getByRole('dialog').getByRole('button', { name: 'Add to Watchlist' }).click();
  expect((await sync).ok()).toBe(true);
  const library = await (await page.request.get('/api/v1/library')).json();
  expect(library.watchlist.map(item => item.title)).toContain('Interstellar');
  await page.getByRole('button', { name: 'Close modal' }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Library', exact: true }).first().click();
  await expect(page.locator('.content-card').filter({ hasText: 'Interstellar' })).toBeVisible();
  if (await page.getByRole('button', { name: 'User Profile' }).isVisible()) await page.getByRole('button', { name: 'User Profile' }).click();
  else await page.getByRole('navigation', { name: 'Mobile Navigation' }).getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('dialog')).toContainText('Signed in as');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
  expect((await page.request.get('/api/v1/library')).status()).toBe(401);
});

test('a missing source is unavailable without requesting unrelated sample media', async ({ page }) => {
  const samples = [];
  page.on('request', request => { if (request.url().includes('gtv-videos-bucket/sample')) samples.push(request.url()); });
  const card = await search(page, 'Test Catalog Film 01');
  await card.locator('.card-play-btn').click();
  await expect(page.getByRole('alert')).toContainText('No playable source is available');
  await expect(page.locator('video')).toHaveCount(0);
  expect(samples).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('detail dialog traps keyboard focus and returns it on Escape', async ({ page }) => {
  const card = await search(page);
  const details = card.getByRole('button', { name: 'Details for Interstellar' });
  await details.focus();
  await page.keyboard.press('Enter');
  const close = page.getByRole('button', { name: 'Close modal' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await page.getByRole('dialog').evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(details).toBeFocused();
});

test('Stremio add-on catalogs bind the selected episode to native decoded playback', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  const requests = [];
  const manifest = { id: 'org.cinepulse.fixture', version: '1.0.0', name: 'Fixture library', description: 'Controlled protocol regression fixture.', types: ['movie', 'series'], resources: ['catalog', 'meta', 'stream'], catalogs: [{ id: 'shows', type: 'series', name: 'Shows', extra: [{ name: 'search' }] }] };
  await page.route('https://addon.example.test/**', async route => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname); requests.push(path);
    const body = path === '/manifest.json' ? manifest : path.startsWith('/catalog/') ? { metas: [{ id: 'fixture:show', type: 'series', name: 'Protocol fixture series' }, { id: 'fixture:show', type: 'series', name: 'Protocol fixture series' }] } : path.startsWith('/meta/') ? { meta: { id: 'fixture:show', type: 'series', name: 'Protocol fixture series', videos: [{ id: 'fixture:show:2:4', title: 'Season 2 Episode 4', season: 2, episode: 4 }] } } : { streams: [{ url: '/media/playback.webm', name: 'Controlled WebM' }, { url: '/media/playback.webm' }, { infoHash: 'unsupported-torrent' }, { url: 'http://localhost/private.mp4' }] };
    await route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.getByRole('button', { name: 'Vega Providers' }).click();
  await page.getByRole('button', { name: 'Stremio add-ons', exact: true }).click();
  await page.getByLabel('Add-on manifest URL').fill('https://addon.example.test/manifest.json');
  await page.getByRole('button', { name: 'Connect add-on' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Connected Fixture library' })).toBeVisible();
  await page.getByRole('button', { name: 'Load add-on titles' }).click();
  await expect(page.getByRole('button', { name: 'Protocol fixture series', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Protocol fixture series', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play Season 2 Episode 4' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Play Season 2 Episode 4' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `.build/screenshots/addon-${testInfo.project.name}.png` });
  await page.getByRole('button', { name: 'Play Season 2 Episode 4' }).click();
  const video = page.locator('video');
  await expect(video).toBeVisible();
  await video.evaluate(async element => { element.muted = true; await element.play(); });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(1);
  expect(requests).toContain('/stream/series/fixture:show:2:4.json');
  expect(requests).not.toContain('/stream/series/fixture:show.json');
  await page.getByRole('button', { name: 'Close Player' }).click();
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('mp_continue_watching'))[0]);
  expect(progress.addon_id).toMatch(/^stremio:/);
  expect(progress.addon_media_id).toBe('fixture:show');
  expect(progress.episode.addon_video_id).toBe('fixture:show:2:4');
  const initialStreams = requests.filter(path => path.startsWith('/stream/')).length;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^Resume Protocol fixture series/ }).click();
  await expect(page.locator('video')).toBeVisible();
  await expect.poll(() => page.locator('video').evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  expect(requests.filter(path => path === '/stream/series/fixture:show:2:4.json').length).toBeGreaterThan(initialStreams);
  expect(requests.filter(path => path.startsWith('/stream/')).every(path => path === '/stream/series/fixture:show:2:4.json')).toBe(true);
  await page.getByRole('button', { name: 'Close Player' }).click();
  await page.getByRole('button', { name: 'Vega Providers' }).click();
  await page.getByRole('button', { name: 'Stremio add-ons', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Fixture library' }).click();
  await page.getByRole('button', { name: 'Close providers' }).click();
  await page.getByRole('button', { name: /^Resume Protocol fixture series/ }).click();
  await expect(page.getByRole('alert')).toContainText('No playable source');
  await page.getByText('Source details', { exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('connection was removed');
  await expect(page.locator('video')).toHaveCount(0);
});

test('add-on connection rejects unsafe URLs and malformed capabilities', async ({ page }) => {
  await page.getByRole('button', { name: 'Vega Providers' }).click();
  await page.getByRole('button', { name: 'Stremio add-ons', exact: true }).click();
  await page.getByLabel('Add-on manifest URL').fill('http://localhost/manifest.json');
  await page.getByRole('button', { name: 'Connect add-on' }).click();
  await expect(page.getByRole('alert')).toContainText('public HTTPS');
  await page.route('https://addon.example.test/manifest.json', route => route.fulfill({ json: { id: 'invalid', name: 'Broken', version: '1.0.0', types: ['movie'], resources: [{ name: 'stream', types: 'movie' }], catalogs: [] }, headers: { 'access-control-allow-origin': '*' } }));
  await page.getByLabel('Add-on manifest URL').fill('https://addon.example.test/manifest.json');
  await page.getByRole('button', { name: 'Connect add-on' }).click();
  await expect(page.getByRole('alert')).toContainText('invalid resource capabilities');
  expect(await page.evaluate(() => localStorage.getItem('mp_stremio_addons'))).toBeNull();
});

test('missing adaptive engine reports failure and an alternate native source recovers', async ({ page }) => {
  await page.route('**/vendor/player-manifest.json', route => route.fulfill({ json: { available: false, engine: 'shaka' } }));
  await page.route('**/playback/sources/movie/**', async route => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1));
    await route.fulfill({ json: { sources: [{ id: 'adaptive-fixture', content_id: id, provider: 'Protocol fixture', format: 'video', url: 'https://media.example.test/fixture.mpd?token=fixture' }, { id: 'native-fixture', content_id: id, provider: 'Protocol fixture', format: 'webm', url: '/media/playback.webm' }] } });
  });
  await (await search(page)).locator('.card-play-btn').click();
  await expect(page.getByRole('alert')).toContainText('Adaptive playback is unavailable');
  await expect(page.locator('.player-session-badge')).toContainText('Playback failed');
  await page.getByRole('button', { name: 'Try another source' }).click();
  const video = page.locator('video');
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate(async element => { element.muted = true; await element.play(); });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.2);
  await expect(page.locator('.player-session-badge')).toContainText('Playing');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('stalled media exposes recovery and switches to a decoded source with the same source id', async ({ page }) => {
  await page.clock.install();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/media/stalled.mp4', async route => {
    await pending;
    await route.abort();
  });
  await page.route('**/playback/sources/movie/**', async route => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1));
    await route.fulfill({ json: { sources: [
      { id: 'duplicate-id', content_id: id, format: 'mp4', url: '/media/stalled.mp4' },
      { id: 'duplicate-id', content_id: id, format: 'webm', url: '/media/playback.webm' },
    ] } });
  });
  try {
    await (await search(page)).locator('.card-play-btn').click();
    await expect(page.locator('video')).toHaveAttribute('src', '/media/stalled.mp4');
    await page.clock.fastForward(21000);
    await expect(page.getByRole('alert')).toContainText('media host did not respond');
    await expect(page.getByRole('button', { name: 'Browse providers', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Try another source' }).click();
    const video = page.locator('video');
    await video.evaluate(async element => { element.muted = true; await element.play(); });
    await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.2);
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally { release(); }
});

test('stalled source resolution times out and allows provider browsing', async ({ page }) => {
  await page.clock.install();
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/playback/sources/movie/**', async route => { await pending; await route.abort(); });
  try {
    await (await search(page)).locator('.card-play-btn').click();
    await expect(page.getByText('Finding sources for Interstellar…')).toBeVisible();
    await page.clock.fastForward(46000);
    await expect(page.getByRole('alert')).toContainText('Finding sources timed out');
    await page.getByRole('button', { name: 'Browse providers', exact: true }).click();
    await expect(page.locator('.vega-modal')).toBeVisible();
    await expect(page.locator('video')).toHaveCount(0);
  } finally { release(); }
});

test('tab navigation resets scroll so Library opens at its heading', async ({ page }, testInfo) => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const navigation = page.getByRole('navigation', { name: testInfo.project.name === 'mobile-chromium' ? 'Mobile Navigation' : 'Main navigation', exact: true });
  await navigation.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your library', exact: true })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

test('series playback requires a selected episode instead of guessing the premiere', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (request.url().includes('/playback/sources/series/')) requests.push(request.url()); });
  await (await search(page, 'Stranger Things')).locator('.card-play-btn').click();
  await expect(page.getByRole('dialog')).toContainText('Seasons & Episodes');
  await page.getByRole('button', { name: 'Choose an episode', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Choose an episode' })).toBeFocused();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(0);
  expect(requests).toEqual([]);
  await page.route('**/playback/sources/series/**', async route => {
    const url = new URL(route.request().url());
    await route.fulfill({ json: { sources: [{ id: 'selected-episode-fixture', content_id: url.pathname.split('/').at(-1), episode_id: url.searchParams.get('episode_id'), provider: 'Controlled episode fixture', format: 'webm', url: '/media/playback.webm' }] } });
  });
  await page.locator('.season-tab-btn').filter({ hasText: 'Season 2' }).click();
  await page.getByRole('button', { name: 'Play Episode', exact: true }).click();
  const video = page.locator('video');
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate(async element => { element.muted = true; await element.play(); });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(1);
  // React StrictMode may retry the same request; every request must use the selected episode.
  expect([...new Set(requests)]).toHaveLength(1);
  expect(new URL(requests[0]).searchParams.get('episode_id')).toBe('s1_s2_e1');
  await page.getByRole('button', { name: 'Close Player' }).click();
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('mp_continue_watching'))[0]);
  expect(progress.episode.season_number).toBe(2);
  expect(progress.episode.id).toBe('s1_s2_e1');
});

test('a series without episodes offers provider browsing instead of an empty player', async ({ page }) => {
  await (await search(page, 'Lanterns')).locator('.card-play-btn').click();
  await expect(page.getByRole('button', { name: 'Choose an episode', exact: true })).toBeDisabled();
  await expect(page.getByRole('dialog')).toContainText('No episodes have been supplied');
  await page.getByRole('button', { name: 'Browse providers', exact: true }).click();
  await expect(page.locator('.vega-modal')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
});

test('detail artwork uses matching metadata enrichment and carries it into playback', async ({ page }) => {
  await page.route('**/api/v1/catalog?**', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.items = data.items.map(item => item.title === 'Interstellar' ? { ...item, imdb_id: 'tt0816692' } : item);
    await route.fulfill({ response, json: data });
  });
  await page.route('**/api/v1/vega/meta/movie/tt0816692', route => route.fulfill({ json: { meta: { id: 'tt0816692', title: 'Interstellar', type: 'movie', poster_url: '/artwork/verified-poster.svg', backdrop_url: '/artwork/verified-backdrop.svg' } } }));
  await page.route('**/artwork/verified-*.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#233952"/></svg>' }));
  const card = await search(page);
  await card.getByRole('button', { name: 'Details for Interstellar' }).click();
  await expect(page.locator('.detail-artwork')).toHaveAttribute('data-artwork-state', 'loaded');
  await expect(page.locator('.detail-artwork img')).toHaveAttribute('src', '/artwork/verified-poster.svg');
  await page.getByRole('button', { name: 'Find playback source', exact: true }).click();
  await expect(page.locator('video')).toHaveAttribute('poster', '/artwork/verified-backdrop.svg');
});
