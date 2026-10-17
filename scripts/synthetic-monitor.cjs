// Synthetic + heartbeat monitor: polls health, readiness, metrics, playback smoke.
// Usage: STATUS_BASE=https://status.example.test node scripts/synthetic-monitor.cjs
const base = process.env.STATUS_BASE || 'http://127.0.0.1:8000';

(async () => {
  const checks = [];
  for (const [name, path, expect] of [
    ['health', '/health', 200],
    ['readiness', '/ready', 200],
    ['liveness', '/livez', 200],
    ['startup', '/startupz', 200],
    ['metrics', '/metrics', 200],
    ['status-page', '/api/v1/status', 200],
  ]) {
    const start = performance.now();
    try {
      const res = await fetch(base + path, { signal: AbortSignal.timeout(8000) });
      checks.push({ name, ok: res.status === expect, status: res.status, ms: Math.round(performance.now() - start) });
    } catch (error) { checks.push({ name, ok: false, error: error.message }); }
  }
  const degraded = checks.filter(check => !check.ok);
  console.log(JSON.stringify({ base, ok: !degraded.length, checks }, null, 2));
  if (degraded.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
