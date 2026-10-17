const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const directory = path.resolve(__dirname, '../.cache/playback-recordings', process.argv[2] || String(Date.now()));
  await fs.mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: directory, size: { width: 1280, height: 720 } } });
  const page = await context.newPage();
  const log = { errors: [], discovery: [], clickError: null, media: null };
  page.on('pageerror', error => log.errors.push(error.message));
  page.on('response', async response => {
    if (response.url().includes('/playback/discover-streams')) log.discovery.push(await response.json().catch(() => ({ status: response.status() })));
  });
  try {
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
    const button = page.getByRole('button', { name: 'Play Interstellar', exact: true }).first();
    await button.waitFor({ timeout: 20000 });
    try { await button.click({ timeout: 5000 }); }
    catch (error) { log.clickError = error.message; await button.focus(); await page.keyboard.press('Enter'); }
    await page.waitForTimeout(48000);
    log.text = await page.locator('.player-container').innerText();
    log.media = await page.locator('video').evaluateAll(videos => videos.map(video => ({ currentTime: video.currentTime, paused: video.paused, readyState: video.readyState, error: video.error?.message })));
    await page.screenshot({ path: path.join(directory, 'player.png'), fullPage: true });
  } catch (error) { log.errors.push(error.message); }
  finally {
    await context.close(); await browser.close();
    await fs.writeFile(path.join(directory, 'diagnostics.json'), JSON.stringify(log, null, 2));
    console.log(JSON.stringify({ directory, ...log }, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });