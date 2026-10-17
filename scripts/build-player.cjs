const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
function buildPlayer(root, required = false) {
  const destination = path.join(root, 'apps/web/public/vendor');
  fs.mkdirSync(destination, { recursive: true });
  const installed = path.join(root, 'apps/web/node_modules/shaka-player');
  const compiled = path.join(installed, 'dist/shaka-player.compiled.js');
  const manifest = { engine: 'shaka', available: false, version: null, license: 'Apache-2.0' };
  if (fs.existsSync(compiled)) {
    const packageInfo = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
    const expected = JSON.parse(fs.readFileSync(path.join(root, 'apps/web/package.json'), 'utf8')).dependencies['shaka-player'];
    if (packageInfo.version !== expected) throw new Error(`Expected Shaka Player ${expected}, found ${packageInfo.version}. Run npm run install:player.`);
    const bytes = fs.readFileSync(compiled);
    const license = path.join(installed, 'LICENSE');
    if (packageInfo.license !== 'Apache-2.0' || !fs.existsSync(license)) throw new Error('Shaka package license is missing or unexpected.');
    fs.writeFileSync(path.join(destination, 'shaka-player.compiled.js'), bytes);
    fs.copyFileSync(license, path.join(destination, 'shaka-LICENSE.txt'));
    Object.assign(manifest, { available: true, version: packageInfo.version, sha256: createHash('sha256').update(bytes).digest('hex') });
  } else {
    for (const filename of ['shaka-player.compiled.js', 'shaka-LICENSE.txt']) fs.rmSync(path.join(destination, filename), { force: true });
  }
  fs.writeFileSync(path.join(destination, 'player-manifest.json'), JSON.stringify(manifest));
  const report = path.join(root, '.build/player');
  fs.mkdirSync(report, { recursive: true });
  fs.writeFileSync(path.join(report, 'build-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(manifest.available ? `Bundled Shaka Player ${manifest.version} with its license.` : 'Shaka is not installed. Native media remains available; adaptive playback reports the missing engine.');
  if (required && !manifest.available) throw new Error('Shaka Player is required for this build. Run npm run install:player with registry access.');
  return manifest;
}

module.exports = { buildPlayer };
if (require.main === module) buildPlayer(path.resolve(__dirname, '..'), process.argv.includes('--required'));
