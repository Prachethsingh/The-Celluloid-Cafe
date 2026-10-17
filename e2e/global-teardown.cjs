module.exports = async () => {
  // Stop only the servers this run started. Existing development servers do
  // not have this per-run token and are left running. This also avoids process
  // tree teardown hangs in restricted Windows execution environments.
  if (!process.env.E2E_SERVER_TOKEN) return;
  await Promise.all([Number(process.env.E2E_API_PORT || 8000), Number(process.env.E2E_WEB_PORT || 5173)].map(async port => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/__e2e/stop`, { method: 'POST', headers: { 'X-E2E-Token': process.env.E2E_SERVER_TOKEN }, signal: AbortSignal.timeout(2000) });
      await response.text();
      if (!response.ok) return;
      // Let the service and its parent shell exit before Playwright attempts
      // process tree cleanup (taskkill is restricted in some Windows hosts).
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        try { await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(250) }); }
        catch { break; }
      }
    } catch { /* A server that already exited needs no cleanup. */ }
  }));
};
