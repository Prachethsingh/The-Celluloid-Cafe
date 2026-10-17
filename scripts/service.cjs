const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
async function main() {
  const service = process.argv[2];
  if (service === 'api') {
    const apiRoot = path.join(root, 'apps/api');
    const compiler = require.resolve('typescript/bin/tsc', { paths: [apiRoot] });
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [compiler, '-p', path.join(apiRoot, 'tsconfig.json')], { cwd: apiRoot, stdio: 'inherit' });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error('API build failed')));
    });
    process.chdir(apiRoot);
    const { app } = await import(pathToFileURL(path.join(apiRoot, 'dist/index.js')).href);
    if (process.env.E2E_SERVER_TOKEN) app.post('/__e2e/stop', context => {
      if (context.req.header('X-E2E-Token') !== process.env.E2E_SERVER_TOKEN) return context.notFound();
      setTimeout(() => process.exit(0), 100);
      return context.json({ stopped: true });
    });
  } else if (service === 'web') {
    const webRoot = path.join(root, 'apps/web');
    process.chdir(webRoot);
    const vite = await import(pathToFileURL(require.resolve('vite', { paths: [webRoot] })).href);
    const server = await vite.createServer({ root: webRoot, configLoader: 'runner', ...(process.env.E2E_WEB_PORT ? { server: { port: Number(process.env.E2E_WEB_PORT) } } : {}) });
    if (process.env.E2E_SERVER_TOKEN) server.middlewares.use('/__e2e/stop', (request, response, next) => {
      if (request.method !== 'POST' || request.headers['x-e2e-token'] !== process.env.E2E_SERVER_TOKEN) return next();
      response.end('stopped');
      setTimeout(() => { server.close(); process.exit(0); }, 100);
    });
    await server.listen();
    server.printUrls();
    const close = async () => { await server.close(); process.exit(0); };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
  } else throw new Error(`Unknown service: ${service}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
