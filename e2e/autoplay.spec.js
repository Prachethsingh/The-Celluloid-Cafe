const { test, expect } = require('@playwright/test');

test('movie completion discovers the next movie, skips unavailable titles and respects autoplay off', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mp_disabled_vega_providers', JSON.stringify(['vega', 'autoEmbed']));
    localStorage.setItem('mp_vega_provider_order', JSON.stringify(['drive', 'vega']));
  });
  await page.goto('/');
  await expect(page.locator('.content-card').first()).toBeVisible();
  const checked = [];
  await page.route('**/playback/sources/**', route => route.fulfill({ json: { sources: [] } }));
  await page.route('**/playback/discover-streams', route => {
    const { content_id, disabled_providers, provider_order } = route.request().postDataJSON(); checked.push(content_id);
    expect(disabled_providers).toEqual([]);
    expect(provider_order).toEqual(['drive', 'vega']);
    const sources = content_id === 'unavailable-next' ? [] : [{ id: content_id, content_id, episode_id: '', provider: 'fixture', format: 'webm', url: '/media/playback.webm' }];
    return route.fulfill({ json: { sources, providers: [{ provider: 'fixture', streams: sources }], diagnostics: [] } });
  });
  let nextCalls = 0;
  await page.route('**/playback/next-playable/**', route => {
    nextCalls++;
    return route.fulfill({ json: { candidates: [{ id: 'unavailable-next', type: 'movie', title: 'Unavailable next' }, { id: 'playable-next', type: 'movie', title: 'Playable next' }] } });
  });
  await page.locator('.content-card').first().locator('.card-play-btn').click();
  await expect(page.locator('video.main-html-video')).toBeVisible();
  await page.locator('video.main-html-video').dispatchEvent('ended');
  await expect(page.locator('#playback-title')).toHaveText('Playable next');
  expect(checked).toContain('unavailable-next');
  expect(checked).toContain('playable-next');
  expect(nextCalls).toBe(1);
  await page.getByRole('button', { name: 'Autoplay next: On' }).click();
  await page.locator('video.main-html-video').dispatchEvent('ended');
  await expect(page.getByRole('button', { name: 'Autoplay next: Off' })).toBeVisible();
  expect(nextCalls).toBe(1);
});

test('closing the player cancels a pending next movie request', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.content-card').first()).toBeVisible();
  await page.route('**/playback/sources/**', route => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1));
    return route.fulfill({ json: { sources: [{ content_id: id, episode_id: '', provider: 'fixture', format: 'webm', url: '/media/playback.webm' }] } });
  });
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/playback/next-playable/**', async route => { await pending; await route.fulfill({ json: { candidates: [] } }).catch(() => {}); });
  await page.locator('.content-card').first().locator('.card-play-btn').click();
  await expect(page.locator('video.main-html-video')).toBeVisible();
  await page.locator('video.main-html-video').dispatchEvent('ended');
  await expect(page.getByText('Finding the next movie…')).toBeVisible();
  await page.getByRole('button', { name: 'Close Player' }).click();
  release();
  await expect(page.locator('.player-container')).toHaveCount(0);
});