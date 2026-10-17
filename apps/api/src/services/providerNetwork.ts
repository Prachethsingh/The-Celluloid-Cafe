import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { withDeadline } from './deadline.js';

export function publicIPv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) || (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
}

// Resolve and pin a public IPv4 address on every hop, including redirects.
export async function providerFetch(value: string, init: any, signal: AbortSignal, hops = 0): Promise<any> {
  signal.throwIfAborted();
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || hops > 3) throw new Error('Blocked provider URL');
  const addresses = await withDeadline(lookup(url.hostname, { family: 4, all: true }), 3000);
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(entry => !publicIPv4(entry.address))) throw new Error('Blocked non-public provider address');
  const headers: Record<string, string> = {};
  for (const [key, val] of new Headers(init.headers || []).entries()) {
    if (!['host', 'connection', 'content-length', 'transfer-encoding', 'cookie', 'authorization', 'accept-encoding'].includes(key.toLowerCase())) headers[key] = val;
  }
  headers['accept-encoding'] = 'identity';
  const body = init.body?.kind === 'base64' ? Buffer.from(init.body.value, 'base64') : Buffer.from(init.body?.value || '');
  if (body.length > 1024 * 1024) throw new Error('Provider request too large');
  const method = String(init.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'POST'].includes(method)) throw new Error('Unsupported provider HTTP method');
  const response: any = await new Promise((resolve, reject) => {
    const req = request(url, {
      method, headers, signal, agent: false,
      lookup: (_host, options, callback: any) => options.all ? callback(null, [addresses[0]]) : callback(null, addresses[0].address, 4),
    }, res => {
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) { res.destroy(new Error('Provider response too large')); return; }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, statusText: res.statusMessage || '', headers: Object.entries(res.headers).flatMap(([key, val]) => val === undefined ? [] : [[key, Array.isArray(val) ? val.join(', ') : val]]), bodyBase64: Buffer.concat(chunks).toString('base64'), url: url.href, location: res.headers.location }));
    });
    req.on('error', reject);
    req.setTimeout(6000, () => req.destroy(new Error('Provider network timeout')));
    req.end(body.length ? body : undefined);
  });
  if ([301, 302, 303, 307, 308].includes(response.status) && response.location && init.redirect !== 'manual') {
    return providerFetch(new URL(response.location, url).href, { method: 'GET' }, signal, hops + 1);
  }
  return response;
}