const { spawn } = require('node:child_process');
const path = require('node:path');
const { existsSync, lstatSync, rmSync } = require('node:fs');

const root = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');

function clean() {
  for (const directory of ['.build', 'apps/api/dist', 'apps/api/.test-build', 'apps/web/dist', 'playwright-report', 'test-results']) {
    const target = path.resolve(root, directory);
    if (!target.startsWith(root + path.sep)) throw new Error('Clean target leaves the project');
    const segments = path.relative(root, target).split(path.sep);
    let current = root;
    for (const segment of segments) {
      current = path.join(current, segment);
      if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Refusing to clean linked directory: ${directory}`);
    }
    rmSync(target, { recursive: true, force: true });
  }
  console.log('Cleaned generated platform builds and test reports.');
}

function run(command, args, cwd = root, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${path.basename(command)} ${args.join(' ')} failed (${signal || code})`)));
  });
}

async function npm(args, directory = '.', env = {}) {
  if (!existsSync(npmCli)) throw new Error('Run this task with npm run so npm_execpath is available.');
  await run(process.execPath, [npmCli, ...args], path.join(root, directory), env);
}

async function build() {
  await run(process.execPath, [path.join(__dirname, 'build-catalog.cjs')]);
  await run(process.execPath, [path.join(__dirname, 'build-providers.cjs')]);
  await run(process.execPath, [path.join(__dirname, 'build-vega-runtime.cjs')]);
  await run(process.execPath, [path.join(__dirname, 'build-player.cjs')]);
  await run(process.execPath, [path.join(__dirname, 'build-api-contract.cjs')]);
  await npm(['run', 'build'], 'apps/api');
  await npm(['run', 'build'], 'apps/web');
}

async function install(all) {
  // Each upstream application retains its own lockfile and React/native versions.
  for (const directory of ['.', 'apps/api', 'apps/web']) await npm(['ci', '--no-audit', '--no-fund'], directory);
  if (all) {
    // The upstream provider lock omits curl-cffi's optional platform packages.
    // npm install repairs those entries while retaining its locked versions.
    await npm(['install', '--ignore-scripts', '--no-audit', '--no-fund'], 'packages/vega-providers');
    await npm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], 'packages/vega-app');
  }
}

async function main() {
  const task = process.argv[2];
  switch (task) {
    case 'clean': return clean();
    case 'build-clean':
      clean();
      return build();
    case 'install': return install(false);
    case 'install-all': return install(true);
    case 'install-player':
      await npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--fetch-retries=0', '--fetch-timeout=10000'], 'apps/web');
      return run(process.execPath, [path.join(__dirname, 'build-player.cjs'), '--required']);
    case 'test-adaptive':
      await run(process.execPath, [path.join(__dirname, 'build-player.cjs'), '--required']);
      return npm(['run', 'test:e2e'], '.', { E2E_ADAPTIVE: '1' });
    case 'build': return build();
    case 'build-all':
      return build();
    case 'contract': return run(process.execPath, [path.join(__dirname, 'build-api-contract.cjs')]);
    case 'lint': return npm(['run', 'lint'], 'apps/web');
    case 'typecheck': return npm(['run', 'typecheck'], 'apps/api');
    case 'test': return npm(['test'], 'apps/api');
    case 'test-all-browsers': return npm(['run', 'test:e2e'], '.', { E2E_ALL_BROWSERS: '1' });
    case 'check-clean':
      clean();
      // Run the same checks against fresh build directories.
    case 'check':
      await run(process.execPath, [path.join(__dirname, 'build-catalog.cjs')]);
      await npm(['run', 'lint'], 'apps/web');
      await npm(['run', 'typecheck'], 'apps/api');
      await npm(['test'], 'apps/api');
      await build();
      await run(process.execPath, [path.join(__dirname, 'test-database.cjs')]);
      return npm(['run', 'test:e2e']);
    case 'dev': {
      await run(process.execPath, [path.join(__dirname, 'build-catalog.cjs')]);
      await run(process.execPath, [path.join(__dirname, 'build-providers.cjs')]);
      await run(process.execPath, [path.join(__dirname, 'build-vega-runtime.cjs')]);
      await run(process.execPath, [path.join(__dirname, 'build-player.cjs')]);
      await npm(['run', 'build'], 'apps/api');
      const services = ['api', 'web'].map(service => spawn(process.execPath, [path.join(__dirname, 'service.cjs'), service], { cwd: root, stdio: 'inherit', env: process.env }));
      const stop = () => services.forEach(service => service.kill());
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
      await Promise.all(services.map(service => new Promise((resolve, reject) => {
        service.once('error', error => { stop(); reject(error); });
        service.once('exit', (code, signal) => { stop(); code === 0 || signal ? resolve() : reject(new Error('Development server failed')); });
      })));
      return;
    }
    default: throw new Error(`Unknown pipeline task: ${task}`);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
