export function titleArtworkUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  if (/^\/artwork\/[A-Za-z0-9._/-]+$/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.hostname.endsWith('unsplash.com') ? url.href : null; } catch { return null; }
}
