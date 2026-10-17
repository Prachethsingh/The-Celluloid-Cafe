const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { importMedia } = require('../scripts/import-media.cjs');

test('imported local movies decode and naturally autoplay the next title through real API routes', async ({ page }) => {
  test.setTimeout(45000);
  const directory = path.resolve(__dirname, '../.build/e2e');
  const movies = [1, 2].map(index => ({
    id: `owned-${test.info().project.name}-${index}`,
    title: `Owned playback regression ${test.info().project.name} clip ${index}`,
    file: path.join(directory, 'playback.webm'),
    provenance: 'Locally encoded regression clip; not commercial movie content',
  }));
  importMedia({ rights_confirmed: true, movies }, {
    databasePath: path.join(directory, `platform-${process.env.E2E_SERVER_TOKEN}.sqlite`),
    mediaDirectory: directory,
  });
  await page.addInitScript(() => localStorage.setItem('mp_autoplay_next', 'true'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).first().click();
  await page.locator('.search-main-input').fill(movies[0].title);
  await page.getByRole('button', { name: `Play ${movies[0].title}`, exact: true }).click();
  const video = page.locator('video.main-html-video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate(async element => { element.muted = true; await element.play(); });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.2);
  expect(await video.evaluate(element => element.videoWidth)).toBe(320);
  await expect(page.locator('#playback-title')).toHaveText(movies[1].title, { timeout: 15000 });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.2);
  expect(await video.evaluate(element => element.videoWidth)).toBe(320);
  expect(await video.evaluate(element => element.error)).toBeNull();
});