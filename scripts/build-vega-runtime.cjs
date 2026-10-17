const fs = require('node:fs/promises');
const path = require('node:path');
const esbuild = require('esbuild');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const nativeRoot = path.join(root, 'packages/vega-app');
const runtimeRoot = path.join(nativeRoot, 'src/lib/sandbox/runtime');
const output = path.join(root, '.build/vega-app');

async function main() {
  let canRebuild = true;
  for (const dependency of ['axios', 'cheerio']) {
    try { require.resolve(dependency, { paths: [nativeRoot] }); }
    catch { canRebuild = false; }
  }
  if (!canRebuild) {
    if (process.env.VEGA_REQUIRE_SOURCE === 'true') throw new Error('Vega source build requires axios and cheerio. Run npm run install:all.');
    // Upstream commits this self-contained bundle for Metro. Package that
    // exact snapshot when native dependencies cannot be downloaded locally.
    const generated = await fs.readFile(path.join(nativeRoot, 'src/lib/sandbox/generated/sandboxRuntime.generated.ts'), 'utf8');
    const match = generated.match(/export const SANDBOX_RUNTIME\s*=\s*("[^\n]*")\s*;/);
    if (!match) throw new Error('The upstream generated sandbox is missing or invalid. Run npm run install:all with registry access.');
    const documentSource = JSON.parse(match[1]);
    const compiled = await esbuild.transform(documentSource, { minify: true, target: 'es2020', legalComments: 'inline' });
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'sandbox-document.js'), compiled.code);
    await fs.writeFile(path.join(output, 'build-manifest.json'), JSON.stringify({ source: 'https://github.com/vega-org/vega-app', version: require(path.join(nativeRoot, 'package.json')).version, mode: 'vendored-generated', sha256: crypto.createHash('sha256').update(generated).digest('hex'), files: ['sandbox-document.js'] }, null, 2) + '\n');
    console.log('Built the Vega app sandbox from its committed generated snapshot. Fresh source rebuild requires npm run install:all with registry access.');
    return;
  }
  const options = { absWorkingDir: root, preserveSymlinks: true, bundle: true, format: 'iife', platform: 'browser', target: 'es2020', minify: true, write: false, legalComments: 'inline' };
  const worker = await esbuild.build({ ...options, entryPoints: [path.join(runtimeRoot, 'sandboxWorker.ts')] });
  const workerSource = worker.outputFiles[0].text;
  const document = await esbuild.build({ ...options, entryPoints: [path.join(runtimeRoot, 'sandboxDocument.ts')], define: { __WORKER_SOURCE__: JSON.stringify(workerSource) } });
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'sandbox-worker.js'), workerSource);
  await fs.writeFile(path.join(output, 'sandbox-document.js'), document.outputFiles[0].text);
  await fs.writeFile(path.join(output, 'build-manifest.json'), JSON.stringify({ source: 'https://github.com/vega-org/vega-app', version: require(path.join(nativeRoot, 'package.json')).version, mode: 'source', files: ['sandbox-worker.js', 'sandbox-document.js'] }, null, 2) + '\n');
  console.log('Built the upstream Vega app worker and document sandbox runtimes.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
