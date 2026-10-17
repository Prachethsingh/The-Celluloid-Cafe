const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'packages/vega-providers');
const output = path.join(root, '.build/vega-providers');

// Providers import local TypeScript utilities and receive libraries from the
// host context. Resolve only those local files; no npm runtime imports belong
// in a provider bundle.
const providerSources = {
  name: 'provider-sources',
  setup(build) {
    build.onResolve({ filter: /.*/ }, async args => {
      // Upstream's optional crypto fallback is guarded by a try/catch. The
      // Vega sandbox already replaces require with an empty-capability shim.
      if (args.path === 'crypto' || args.path === 'node:crypto') return { path: args.path, external: true };
      if (args.kind !== 'entry-point' && !args.path.startsWith('.')) throw new Error(`Unexpected provider dependency: ${args.path}`);
      const filename = path.resolve(args.resolveDir || root, args.path);
      if (!filename.startsWith(path.join(source, 'providers') + path.sep)) throw new Error(`Provider import leaves the source directory: ${args.path}`);
      for (const candidate of [filename, `${filename}.ts`, path.join(filename, 'index.ts')]) {
        try { if ((await fs.stat(candidate)).isFile()) return { path: candidate, namespace: 'provider-source' }; } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
      }
      throw new Error(`Provider source not found: ${args.path}`);
    });
    build.onLoad({ filter: /.*/, namespace: 'provider-source' }, async args => ({ contents: await fs.readFile(args.path, 'utf8'), loader: 'ts', resolveDir: path.dirname(args.path) }));
  },
};

async function main() {
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'));
  const providers = [];
  const names = new Set();
  await fs.mkdir(output, { recursive: true });
  for (const provider of manifest) {
    if (!/^[a-zA-Z0-9_-]+$/.test(provider.value) || names.has(provider.value)) throw new Error(`Invalid or duplicate provider: ${provider.value}`);
    names.add(provider.value);
    const directory = path.join(source, 'providers', provider.value);
    const modules = (await fs.readdir(directory)).filter(file => /^(catalog|posts|meta|stream|episodes|settings)\.ts$/.test(file));
    if (!modules.includes('stream.ts')) throw new Error(`${provider.value} has no stream module`);
    const built = [];
    for (const module of modules) {
      const input = path.join(directory, module);
      const moduleName = module.replace(/\.ts$/, '.js');
      const outfile = path.join(output, provider.value, moduleName);
      const result = await esbuild.build({ absWorkingDir: root, tsconfigRaw: {}, plugins: [providerSources], entryPoints: [input], outfile, bundle: true, format: 'cjs', platform: 'browser', target: 'es2020', minify: true, keepNames: true, write: false });
      const code = result.outputFiles[0].text;
      await fs.mkdir(path.dirname(outfile), { recursive: true });
      await fs.writeFile(outfile, code);
      built.push({ name: moduleName, bytes: Buffer.byteLength(code), sha256: crypto.createHash('sha256').update(code).digest('hex') });
    }
    providers.push({ value: provider.value, version: provider.version, modules: built });
  }
  await fs.copyFile(path.join(source, 'manifest.json'), path.join(output, 'manifest.json'));
  await fs.copyFile(path.join(source, 'urls.json'), path.join(output, 'urls.json'));
  await fs.writeFile(path.join(output, 'build-manifest.json'), JSON.stringify({ source: 'https://github.com/Zenda-Cross/vega-providers', providers }, null, 2) + '\n');
  console.log(`Built ${providers.reduce((total, provider) => total + provider.modules.length, 0)} modules from all ${providers.length} Vega providers.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
