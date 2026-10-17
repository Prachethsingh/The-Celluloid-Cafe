const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { buildPlayer } = require('./build-player.cjs');

test('player builds verify the pinned version, license, bytes and missing-runtime state', () => {
  const parent = path.resolve(__dirname, '../.build/player-tests');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'build-'));
  const web = path.join(root, 'apps/web');
  const installed = path.join(web, 'node_modules/shaka-player');
  fs.mkdirSync(web, { recursive: true });
  fs.writeFileSync(path.join(web, 'package.json'), JSON.stringify({ dependencies: { 'shaka-player': '5.2.12' } }));
  try {
    assert.equal(buildPlayer(root).available, false);
    assert.throws(() => buildPlayer(root, true), /Shaka Player is required/);
    fs.mkdirSync(path.join(installed, 'dist'), { recursive: true });
    const bytes = Buffer.from('/* Controlled build fixture, not a player runtime. */');
    fs.writeFileSync(path.join(installed, 'dist/shaka-player.compiled.js'), bytes);
    const metadata = version => fs.writeFileSync(path.join(installed, 'package.json'), JSON.stringify({ version, license: 'Apache-2.0' }));
    metadata('5.2.11');
    assert.throws(() => buildPlayer(root), /Expected Shaka Player 5.2.12/);
    metadata('5.2.12');
    assert.throws(() => buildPlayer(root), /license is missing/);
    fs.writeFileSync(path.join(installed, 'LICENSE'), 'Controlled license fixture');
    const manifest = buildPlayer(root, true);
    assert.equal(manifest.available, true);
    assert.equal(manifest.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(fs.readFileSync(path.join(web, 'public/vendor/shaka-player.compiled.js')), bytes);
    fs.unlinkSync(path.join(installed, 'dist/shaka-player.compiled.js'));
    assert.equal(buildPlayer(root).available, false);
    assert.equal(fs.existsSync(path.join(web, 'public/vendor/shaka-player.compiled.js')), false);
    assert.equal(fs.existsSync(path.join(web, 'public/vendor/shaka-LICENSE.txt')), false);
  } finally {
    if (!root.startsWith(parent + path.sep)) throw new Error('Test cleanup leaves its workspace');
    fs.rmSync(root, { recursive: true, force: true });
  }
});
