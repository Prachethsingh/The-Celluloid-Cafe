import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';

const buckets = new Map<string, { count: number; until: number }>();

// In-memory RED/USE signals: rate, errors, duration histograms, saturation.
export const requestDurations: number[] = [];
const routeStats = new Map<string, { count: number; errors: number; totalMs: number }>();
let saturationPeak = 0;
let inFlight = 0;

function percentile(sorted: number[], fraction: number) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

export function metricsSnapshot() {
  const sorted = [...requestDurations].sort((a, b) => a - b);
  const routes = [...routeStats.entries()].map(([route, stats]) => ({
    route, count: stats.count, errors: stats.errors,
    error_rate: stats.count ? stats.errors / stats.count : 0,
    avg_ms: stats.count ? stats.totalMs / stats.count : 0,
  }));
  const total = routes.reduce((sum, route) => sum + route.count, 0);
  const errors = routes.reduce((sum, route) => sum + route.errors, 0);
  return {
    uptime_seconds: Math.round(process.uptime()),
    requests_total: total,
    error_rate: total ? errors / total : 0,
    in_flight: inFlight,
    saturation_peak: saturationPeak,
    latency_ms: { p50: percentile(sorted, 0.5), p90: percentile(sorted, 0.9), p95: percentile(sorted, 0.95), p99: percentile(sorted, 0.99), samples: sorted.length },
    routes,
  };
}

export function prometheusMetrics() {
  const snapshot = metricsSnapshot();
  const lines = [
    '# HELP movie_platform_requests_total Total HTTP requests.',
    '# TYPE movie_platform_requests_total counter',
    `movie_platform_requests_total ${snapshot.requests_total}`,
    '# HELP movie_platform_errors_total Total HTTP error responses.',
    '# TYPE movie_platform_errors_total counter',
    `movie_platform_errors_total ${snapshot.routes.reduce((sum, route) => sum + route.errors, 0)}`,
    '# HELP movie_platform_latency_ms Request latency percentiles.',
    '# TYPE movie_platform_latency_ms gauge',
    `movie_platform_latency_ms{quantile="0.5"} ${snapshot.latency_ms.p50}`,
    `movie_platform_latency_ms{quantile="0.9"} ${snapshot.latency_ms.p90}`,
    `movie_platform_latency_ms{quantile="0.95"} ${snapshot.latency_ms.p95}`,
    `movie_platform_latency_ms{quantile="0.99"} ${snapshot.latency_ms.p99}`,
    '# HELP movie_platform_in_flight Current in-flight requests.',
    '# TYPE movie_platform_in_flight gauge',
    `movie_platform_in_flight ${snapshot.in_flight}`,
  ];
  for (const route of snapshot.routes) {
    const name = route.route.replace(/[^a-zA-Z0-9_]/g, '_');
    lines.push(`movie_platform_route_requests_total{route="${name}"} ${route.count}`);
    lines.push(`movie_platform_route_errors_total{route="${name}"} ${route.errors}`);
  }
  return lines.join('\n') + '\n';
}

export const platformMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = randomUUID();
  const traceId = c.req.header('traceparent')?.split('-')[1] || requestId.replace(/-/g, '').slice(0, 32);
  const start = performance.now();
  inFlight += 1;
  saturationPeak = Math.max(saturationPeak, inFlight);
  c.header('X-Request-ID', requestId);
  c.header('traceparent', `00-${traceId}-${requestId.replace(/-/g, '').slice(0, 16)}-01`);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'same-origin');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('Cache-Control', 'no-store');
  const now = Date.now();
  for (const [key, value] of buckets) if (value.until <= now) buckets.delete(key);
  const ip = c.env?.incoming?.socket?.remoteAddress || 'local';
  const auth = c.req.path.startsWith('/api/v1/auth/') && !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method);
  const key = `${ip}:${auth ? 'auth' : 'api'}`;
  const bucket = buckets.get(key) || { count: 0, until: now + 60000 };
  buckets.set(key, bucket);
  if (++bucket.count > (auth ? 60 : 600)) {
    c.header('Retry-After', String(Math.ceil((bucket.until - now) / 1000)));
    return c.json({ error: 'Request limit reached', request_id: requestId }, 429);
  }
  try { await next(); }
  finally {
    inFlight -= 1;
    const duration = Math.round((performance.now() - start) * 100) / 100;
    requestDurations.push(duration);
    if (requestDurations.length > 2000) requestDurations.splice(0, requestDurations.length - 2000);
    const route = `${c.req.method} ${c.req.routePath || c.req.path}`;
    const stats = routeStats.get(route) || { count: 0, errors: 0, totalMs: 0 };
    stats.count += 1;
    stats.totalMs += duration;
    if (c.res.status >= 500) stats.errors += 1;
    routeStats.set(route, stats);
    if (process.env.NODE_ENV !== 'test') console.log(JSON.stringify({ event: 'http.request', request_id: requestId, trace_id: traceId, method: c.req.method, path: c.req.path, status: c.res.status, duration_ms: duration }));
  }
};
