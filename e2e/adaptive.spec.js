const { test, expect } = require('@playwright/test');

for (const format of ['mpd', 'm3u8']) {
  test(`installed Shaka decodes local ${format === 'mpd' ? 'DASH' : 'HLS'} and releases it on close`, async ({ page, request }) => {
    const manifest = await (await request.get('/vendor/player-manifest.json')).json();
    expect(manifest.available, 'Run npm run install:player before testing adaptive decoding.').toBe(true);
    const mediaRequests = [];
    page.on('request', request => { if (request.url().includes('/media/adaptive')) mediaRequests.push(request.url()); });
    await page.route('**/playback/sources/movie/**', async route => {
      const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1));
      await route.fulfill({ json: { sources: [{ id: `local-${format}`, content_id: id, provider: 'Local adaptive regression fixture', format, url: `/media/adaptive.${format}` }] } });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Search', exact: true }).first().click();
    await page.locator('.search-main-input').fill('Interstellar');
    const card = page.locator('.content-card').filter({ hasText: 'Interstellar' }).first();
    await expect(card).toBeVisible();
    await card.locator('.card-play-btn').click();
    const video = page.locator('video');
    await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
    await video.evaluate(async element => { element.muted = true; await element.play(); });
    await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(1);
    await expect(page.locator('.player-session-badge')).toContainText('Playing');
    // Confirm the installed runtime was loaded and Shaka provided actual tracks.
    expect(await page.evaluate(() => !!globalThis.shaka?.Player)).toBe(true);
    await page.getByText('Playback settings', { exact: true }).click();
    const quality = page.getByLabel('Video quality');
    await expect(quality).toBeVisible();
    expect(await quality.locator('option').count()).toBeGreaterThan(1);
    expect(mediaRequests.some(url => url.includes(format === 'mpd' ? 'adaptive-segment.webm' : '.m4s'))).toBe(true);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Close Player' }).click();
    await expect(video).toHaveCount(0);
  });
}
