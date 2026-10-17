import { Hono } from 'hono';
import fs from 'node:fs';
import path from 'node:path';
import { repositoryRoot } from '../services/repository.js';

export const mediaRouter = new Hono();
mediaRouter.get('/:filename', c => {
  const filename = c.req.param('filename');
  if (!/^[A-Za-z0-9_-]+\.(mp4|webm|vtt|m3u8|mpd|ts|m4s)$/.test(filename)) return c.notFound();
  const directory = path.resolve(repositoryRoot, process.env.MEDIA_DIRECTORY || 'data/media');
  const file = path.join(directory, filename);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) return c.notFound();
  const size = fs.statSync(file).size;
  const types: Record<string, string> = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.vtt': 'text/vtt', '.m3u8': 'application/vnd.apple.mpegurl', '.mpd': 'application/dash+xml', '.ts': 'video/mp2t', '.m4s': 'video/iso.segment' };
  c.header('Content-Type', types[path.extname(filename)]);
  c.header('Accept-Ranges', 'bytes');
  const range = c.req.header('Range');
  let start = 0, end = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) { c.header('Content-Range', `bytes */${size}`); return c.body(null, 416); }
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) { c.header('Content-Range', `bytes */${size}`); return c.body(null, 416); }
    c.header('Content-Range', `bytes ${start}-${end}/${size}`);
  }
  c.header('Content-Length', String(end - start + 1));
  const stream = fs.createReadStream(file, { start, end });
  const readable = new ReadableStream({
    start(controller) { stream.on('data', chunk => controller.enqueue(new Uint8Array(chunk as Buffer))); stream.on('end', () => controller.close()); stream.on('error', error => controller.error(error)); },
    cancel() { stream.destroy(); },
  });
  return new Response(readable, { status: range ? 206 : 200, headers: c.res.headers });
});
