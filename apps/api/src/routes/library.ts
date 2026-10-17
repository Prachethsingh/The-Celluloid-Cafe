import { Hono } from 'hono';
import { z } from 'zod';
import { getDatabase } from '../services/database.js';
import { requireAccount, readSession } from '../services/auth.js';

export const libraryRouter = new Hono();
libraryRouter.use('*', requireAccount);
libraryRouter.get('/', c => {
  const rows = getDatabase().prepare('SELECT kind,data FROM library WHERE user_id=? ORDER BY updated_at DESC').all(readSession(c)!.user.id);
  return c.json({ watchlist: rows.filter(row => row.kind === 'watchlist').map(row => JSON.parse(String(row.data))), progress: rows.filter(row => row.kind === 'progress').map(row => JSON.parse(String(row.data))) });
});
const itemSchema = z.object({ id: z.string().min(1).max(150), title: z.string().min(1).max(300), type: z.enum(['movie', 'series']), progress_seconds: z.number().min(0).max(1000000).optional(), duration_seconds: z.number().min(0).max(1000000).optional() }).passthrough();
libraryRouter.put('/:kind/:id', async c => {
  const { kind, id } = c.req.param();
  if (!['watchlist', 'progress'].includes(kind)) return c.json({ error: 'Invalid library kind' }, 400);
  const parsed = itemSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || parsed.data.id !== id || JSON.stringify(parsed.data).length > 16384) return c.json({ error: 'Invalid library item' }, 400);
  getDatabase().prepare('INSERT INTO library VALUES(?,?,?,?,?) ON CONFLICT(user_id,kind,content_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').run(readSession(c)!.user.id, kind, id, JSON.stringify(parsed.data), new Date().toISOString());
  return c.json({ success: true });
});
libraryRouter.delete('/:kind/:id', c => {
  const { kind, id } = c.req.param();
  if (!['watchlist', 'progress'].includes(kind)) return c.json({ error: 'Invalid library kind' }, 400);
  getDatabase().prepare('DELETE FROM library WHERE user_id=? AND kind=? AND content_id=?').run(readSession(c)!.user.id, kind, id);
  return c.json({ success: true });
});
