const { test, expect } = require('@playwright/test');

test.use({ video: 'on' });

test('decoded local fixture recovers from a broken adaptive source and naturally advances', async ({ page }) => {
  test.setTimeout(45000);
  await page.addInitScript(() => { localStorage.setItem('mp_autoplay_next', 'true'); });
  const titles = [
    { id: 'fixture-first', title: 'Local playback test — first clip', type: 'movie', year: 2020 },
    { id: 'fixture-next', title: 'Local playback test — next clip', type: 'movie', year: 2020 },
  ];
  await page.route('**/api/v1/catalog?**', route => route.fulfill({ json: { items: titles, total: 2, page: 1, has_more: false } }));
  await page.route('**/playback/sources/**', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    const good = { content_id: id, episode_id: '', provider: 'Local encoded test fixture', format: 'webm', url: '/media/playback.webm' };
    return route.fulfill({ json: { sources: id === 'fixture-first' ? [{ ...good, format: 'mpd', url: '/media/broken.mpd' }, good] : [good] } });
  });
  await page.route('**/media/broken.mpd', route => route.fulfill({ status: 200, contentType: 'application/dash+xml', body: '<invalid />' }));
  await page.route('**/playback/next-playable/**', route => route.fulfill({ json: { candidates: route.request().url().endsWith('fixture-first') ? [titles[1]] : [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Local playback test — first clip', exact: true }).click();
  const video = page.locator('video.main-html-video');
  await expect.poll(() => video.evaluate(element => element.currentSrc), { timeout: 20000 }).toContain('/media/playback.webm');
  // Muting is only for the automated browser's autoplay policy, not fake media.
  await video.evaluate(async element => { element.muted = true; await element.play(); });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.2);
  expect(await video.evaluate(element => element.videoWidth)).toBe(320);
  await expect(page.locator('#playback-title')).toHaveText(titles[1].title, { timeout: 15000 });
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate(async element => { element.muted = true; await element.play(); });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.2);
  expect(await video.evaluate(element => element.error)).toBeNull();
});