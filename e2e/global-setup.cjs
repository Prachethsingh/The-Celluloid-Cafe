const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const apiOrigin = `http://127.0.0.1:${process.env.E2E_API_PORT || 8000}`;

// Use a local encoded file so the tests verify media decoding and do not
// depend on a public CDN or count a synthetic canvas feed as video playback.
module.exports = async () => {
  const stopServers = process.platform === 'win32' ? await require('./servers.cjs')() : undefined;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const bytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const context = canvas.getContext('2d');
      const stream = canvas.captureStream(20);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      const chunks = [];
      recorder.ondataavailable = event => chunks.push(event.data);
      const finished = new Promise(resolve => { recorder.onstop = resolve; });
      let frame = 0;
      const draw = () => {
        context.fillStyle = frame++ % 2 ? '#233952' : '#477ba8';
        context.fillRect(0, 0, 320, 180);
        context.fillStyle = '#fff';
        context.font = '24px sans-serif';
        context.fillText(`CinePulse test video ${frame}`, 20, 90);
      };
      draw();
      recorder.start();
      const timer = setInterval(draw, 50);
      await new Promise(resolve => setTimeout(resolve, 6000));
      recorder.stop();
      await finished;
      clearInterval(timer);
      stream.getTracks().forEach(track => track.stop());
      return Array.from(new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()));
    });
    const directory = path.resolve(__dirname, '../.build/e2e');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'playback.webm'), Buffer.from(bytes));
    if (process.env.E2E_ADAPTIVE === '1') await require('./adaptive-fixtures.cjs')(page, directory, Buffer.from(bytes));
    const database = new DatabaseSync(path.join(directory, `platform-${process.env.E2E_SERVER_TOKEN}.sqlite`));
    try {
      database.exec('PRAGMA busy_timeout=5000');
      const insert = database.prepare('INSERT OR REPLACE INTO media(id,type,title,data) VALUES(?,?,?,?)');
      const movies = Array.from({ length: 16 }, (_, index) => ({
        id: `e2e-movie-${String(index + 1).padStart(2, '0')}`, type: 'movie', title: `Test Catalog Film ${String(index + 1).padStart(2, '0')}`,
        year: 2020, genres: ['Drama'], cast: [], description: 'Isolated end-to-end catalog fixture.', poster_url: null, backdrop_url: null,
        rating: null, availability: {}, availability_verified: false, metadata_provenance: 'e2e-fixture'
      }));
      movies.push({
        id: 'tt0816692', imdb_id: 'tt0816692', type: 'movie', title: 'Interstellar', year: 2014,
        genres: ['Sci-Fi', 'Drama'], cast: [], description: 'Isolated end-to-end playback fixture.', runtime: '2h 49m',
        poster_url: null, backdrop_url: null, rating: null, availability: {}, availability_verified: false, metadata_provenance: 'e2e-fixture'
      });
      movies.push({
        id: 'e2e-east-of-eden', type: 'movie', title: 'East of Eden', year: 1955, genres: ['Drama'], cast: [],
        description: 'Isolated title without a configured playback source.', poster_url: null, backdrop_url: null,
        rating: null, availability: {}, availability_verified: false, metadata_provenance: 'e2e-fixture'
      });
      movies.push({
        id: 'e2e-lanterns', type: 'series', title: 'Lanterns', year: 2026, genres: ['Drama'], cast: [],
        description: 'Isolated series fixture without episode metadata.', poster_url: null, backdrop_url: null,
        rating: null, availability: {}, availability_verified: false, metadata_provenance: 'e2e-fixture'
      });
      const series = {
        id: 'e2e-stranger-things', type: 'series', title: 'Stranger Things', year: 2016, genres: ['Sci-Fi', 'Drama'],
        cast: [], description: 'Isolated end-to-end series fixture.', poster_url: null, backdrop_url: null,
        rating: null, availability: {}, availability_verified: false, metadata_provenance: 'e2e-fixture',
        seasons: [1, 2].map(season => ({
          id: `s1_s${season}`, season_number: season, title: `Season ${season}`,
          episodes: [{ id: `s1_s${season}_e1`, episode_number: 1, title: `Episode ${season}`, runtime: '45m', description: 'Test episode fixture.' }]
        }))
      };
      for (const item of [...movies, series]) insert.run(item.id, item.type, item.title, JSON.stringify(item));
    } finally { database.close(); }
    const login = await fetch(`${apiOrigin}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD }),
    });
    if (!login.ok) throw new Error('Unable to provision isolated playback test sources. Stop development servers before running E2E tests.');
    const identity = await login.json();
    const catalog = await (await fetch(`${apiOrigin}/api/v1/catalog?q=Interstellar`)).json();
    const title = catalog.items.find(item => item.title === 'Interstellar');
    if (!title) throw new Error('Playback fixture title is missing from the canonical catalog');
    const fixture = await fetch(`${apiOrigin}/api/v1/admin/sources`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: login.headers.get('set-cookie').split(';')[0], 'X-CSRF-Token': identity.csrf },
      body: JSON.stringify({ content_id: title.id, type: 'movie', url: '/media/playback.webm', name: 'Encoded regression fixture', format: 'webm', provenance: 'Local test fixture; not actual Interstellar media' }),
    });
    if (!fixture.ok) throw new Error('Playback fixture source registration failed');
  } catch (error) { await stopServers?.(); throw error; }
  finally { await browser.close(); }
  return stopServers;
};
