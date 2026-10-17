// Load / stress / spike / soak probe against /health + /ready + /metrics.
// Usage: node scripts/load-test.cjs [--rps 50] [--seconds 30] [--spike 200]
const rps = Number(process.argv.find((arg, i) => process.argv[i - 1] === '--rps') || 50);
const seconds = Number(process.argv.find((arg, i) => process.argv[i - 1] === '--seconds') || 30);
const spike = Number(process.argv.find((arg, i) => process.argv[i - 1] === '--spike') || 0);
const base = process.env.LOAD_BASE || 'http://127.0.0.1:8000';
const budgets = { p95_ms: 800, error_rate: 0.01 };

(async () => {
  const latencies = [];
  let errors = 0, total = 0;
  const deadline = Date.now() + seconds * 1000;
  const paths = ['/health', '/ready', '/metrics', '/api/v1/metrics'];
  while (Date.now() < deadline) {
    const batch = Array.from({ length: rps }, (_, i) => paths[(total + i) % paths.length]);
    const burst = spike && total % (rps * 5) === 0 ? spike : 0;
    await Promise.all([...batch, ...Array.from({ length: burst }, () => '/health')].map(async path => {
      const start = performance.now();
      try {
        const res = await fetch(base + path, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) errors += 1;
      } catch { errors += 1; }
      latencies.push(performance.now() - start);
      total += 1;
    }));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(0.95 * latencies.length)] || 0;
  const errorRate = total ? errors / total : 0;
  console.log(JSON.stringify({ total, errors, error_rate: errorRate, p95_ms: Math.round(p95 * 100) / 100, budgets }, null, 2));
  if (p95 > budgets.p95_ms || errorRate > budgets.error_rate) {
    console.error('Performance budget breached.');
    process.exitCode = 1;
  } else console.log('Performance budgets passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
