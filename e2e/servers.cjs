const { spawn } = require('node:child_process');
const path = require('node:path');

module.exports = async function startServers() {
  const children = [];
  const root = path.resolve(__dirname, '..');
  async function available(url) {
    try { return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok; }
    catch { return false; }
  }
  const stop = async () => {
    await require('./global-teardown.cjs')();
    for (const child of children) if (child.exitCode === null) child.kill();
  };
  try {
    const apiPort = Number(process.env.E2E_API_PORT || 8000);
    const webPort = Number(process.env.E2E_WEB_PORT || 5173);
    for (const [name, url] of [['api', `http://127.0.0.1:${apiPort}/health`], ['web', `http://127.0.0.1:${webPort}/`]]) {
      if (await available(url)) {
        if (process.env.CI) throw new Error(`Test service port is already in use: ${url}`);
        continue;
      }
      // Spawn Node directly: restricted Windows hosts cannot use taskkill to
      // tear down Playwright's command-shell process tree reliably.
      const child = spawn(process.execPath, [path.join(root, 'scripts/service.cjs'), name], {
        cwd: root, stdio: ['ignore', 'ignore', 'inherit'],
        env: { ...process.env, PORT: String(apiPort), API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`, ALLOWED_ORIGINS: `http://127.0.0.1:${webPort}`, VEGA_OFFLINE: 'true', ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL || '', ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD || '', MEDIA_DIRECTORY: path.join(root, '.build/e2e') },
      });
      children.push(child);
      let spawnError;
      child.on('error', error => { spawnError = error; });
      const deadline = Date.now() + 60000;
      while (!(await available(url))) {
        if (spawnError) throw spawnError;
        if (child.exitCode !== null) throw new Error(`${name} test server exited with ${child.exitCode}`);
        if (Date.now() > deadline) throw new Error(`${name} test server did not become ready`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    return stop;
  } catch (error) { await stop(); throw error; }
};
