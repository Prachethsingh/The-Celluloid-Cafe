import { Hono } from 'hono';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../services/database.js';
import { hashPassword, checkPassword, publicAccount, issueSession, readSession, revokeSession, requireAccount, audit } from '../services/auth.js';

export const authRouter = new Hono();
const credentials = z.object({ email: z.string().email().max(254).transform(value => value.toLowerCase()), password: z.string().min(12).max(128), display_name: z.string().trim().min(1).max(80).optional() }).strict();
const attempts = new Map<string, { count: number; until: number }>();
authRouter.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (c.req.method === 'POST' && ['register', 'login'].includes(c.req.path.split('/').at(-1)!)) {
    const origin = c.req.header('Origin');
    const allowed = (process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173').split(',');
    if (origin && origin !== new URL(c.req.url).origin && !allowed.includes(origin)) return c.json({ error: 'Origin not allowed' }, 403);
  }
  await next();
});
authRouter.get('/session', c => {
  const session = readSession(c);
  return c.json(session ? { user: session.user, csrf: session.csrf } : { user: null, csrf: null });
});
authRouter.post('/register', async c => {
  const body = credentials.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'Provide a valid email and a password of 12-128 characters' }, 400);
  const { email, password, display_name } = body.data;
  const db = getDatabase();
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return c.json({ error: 'Account cannot be created with these details' }, 409);
  const user = { id: randomUUID(), email, display_name: display_name || email.split('@')[0], role: 'user' as const, created_at: new Date().toISOString() };
  const passwordHash = await hashPassword(password);
  try { db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(user.id, email, user.display_name, passwordHash, user.role, user.created_at); }
  catch { return c.json({ error: 'Account cannot be created with these details' }, 409); }
  audit(user.id, 'account.register', user.id);
  return c.json(issueSession(c, user), 201);
});
authRouter.post('/login', async c => {
  const body = credentials.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'Invalid credentials' }, 400);
  const { email, password } = body.data;
  const now = Date.now();
  for (const [key, attempt] of attempts) if (attempt.until <= now) attempts.delete(key);
  const attempt = attempts.get(email);
  if (attempt && attempt.count >= 5 && attempt.until > now) return c.json({ error: 'Too many attempts. Try again later.' }, 429);
  const row = getDatabase().prepare('SELECT * FROM users WHERE email=?').get(email);
  const valid = await checkPassword(password, String(row?.password_hash || 'scrypt$00000000000000000000000000000000$' + '00'.repeat(64)));
  if (!row || !valid) {
    attempts.set(email, { count: (attempt?.count || 0) + 1, until: attempt?.until || now + 15 * 60000 });
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  attempts.delete(email);
  const user = publicAccount(row);
  audit(user.id, 'account.login', user.id);
  return c.json(issueSession(c, user));
});
authRouter.post('/logout', requireAccount, c => { revokeSession(c); return c.json({ success: true }); });
authRouter.post('/password', requireAccount, async c => {
  const session = readSession(c)!;
  const parsed = z.object({ current_password: z.string().min(1).max(128), new_password: z.string().min(12).max(128) }).strict().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Provide your current password and a new password of 12-128 characters' }, 400);
  const row = getDatabase().prepare('SELECT password_hash FROM users WHERE id=?').get(session.user.id)!;
  if (!(await checkPassword(parsed.data.current_password, String(row.password_hash)))) return c.json({ error: 'Current password is incorrect' }, 403);
  if (parsed.data.current_password === parsed.data.new_password) return c.json({ error: 'Choose a different password' }, 400);
  const hash = await hashPassword(parsed.data.new_password);
  const db = getDatabase();
  db.exec('BEGIN');
  try { db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, session.user.id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(session.user.id); db.exec('COMMIT'); }
  catch (error) { db.exec('ROLLBACK'); throw error; }
  audit(session.user.id, 'account.password-change', session.user.id);
  return c.json(issueSession(c, session.user));
});
authRouter.get('/sessions', requireAccount, c => {
  const session = readSession(c)!;
  const rows = getDatabase().prepare('SELECT token_hash,expires_at FROM sessions WHERE user_id=? AND expires_at>?').all(session.user.id, Date.now());
  return c.json({ sessions: rows.map(row => ({ id: row.token_hash, expires_at: row.expires_at, current: row.token_hash === session.hash })) });
});
authRouter.delete('/sessions/:id', requireAccount, c => {
  const session = readSession(c)!;
  getDatabase().prepare('DELETE FROM sessions WHERE user_id=? AND token_hash=?').run(session.user.id, c.req.param('id'));
  return c.json({ success: true });
});
authRouter.get('/export', requireAccount, c => {
  const user = readSession(c)!.user;
  const library = getDatabase().prepare('SELECT kind,content_id,data,updated_at FROM library WHERE user_id=?').all(user.id);
  return c.json({ user, library: library.map(row => ({ ...row, data: JSON.parse(String(row.data)) })), exported_at: new Date().toISOString() });
});
authRouter.delete('/account', requireAccount, async c => {
  const session = readSession(c)!;
  const body = await c.req.json().catch(() => ({}));
  const row = getDatabase().prepare('SELECT password_hash FROM users WHERE id=?').get(session.user.id);
  if (typeof body.password !== 'string' || body.password.length > 128 || !(await checkPassword(body.password, String(row?.password_hash)))) return c.json({ error: 'Password confirmation required' }, 403);
  getDatabase().prepare('DELETE FROM users WHERE id=?').run(session.user.id);
  revokeSession(c);
  audit(null, 'account.delete', 'deleted-account');
  return c.json({ success: true });
});
