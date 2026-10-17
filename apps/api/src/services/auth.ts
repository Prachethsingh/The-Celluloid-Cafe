import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { getDatabase } from './database.js';

export type Account = { id: string; email: string; display_name: string; role: 'user' | 'admin'; created_at: string };
type Session = { user: Account; csrf: string; hash: string };
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key)));

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function checkPassword(password: string, encoded: string) {
  const [algorithm, salt, expected] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const key = await derive(password, salt);
  const stored = Buffer.from(expected, 'hex');
  return key.length === stored.length && timingSafeEqual(key, stored);
}
export function publicAccount(row: any): Account {
  return { id: row.id, email: row.email, display_name: row.display_name, role: row.role, created_at: row.created_at };
}
export function readSession(c: Context): Session | null {
  const token = getCookie(c, 'cp_session');
  if (!token || token.length !== 64) return null;
  const hash = hashToken(token);
  const row = getDatabase().prepare('SELECT users.*, sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?').get(hash, Date.now());
  return row ? { user: publicAccount(row), csrf: String(row.csrf), hash } : null;
}
export function issueSession(c: Context, user: Account) {
  const token = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  const db = getDatabase();
  const previous = getCookie(c, 'cp_session');
  if (previous) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(previous));
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hashToken(token), user.id, csrf, Date.now() + 7 * 86400000);
  setCookie(c, 'cp_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', path: '/', maxAge: 7 * 86400 });
  return { user, csrf };
}
export function revokeSession(c: Context) {
  const token = getCookie(c, 'cp_session');
  if (token) getDatabase().prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
  deleteCookie(c, 'cp_session', { path: '/' });
}
export function audit(userId: string | null, action: string, resource: string) {
  getDatabase().prepare('INSERT INTO audit VALUES(?,?,?,?,?)').run(randomUUID(), userId, action, resource, new Date().toISOString());
}
export const requireAccount: MiddlewareHandler = async (c, next) => {
  const session = readSession(c);
  if (!session) return c.json({ error: 'Sign in required' }, 401);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.header('X-CSRF-Token') !== session.csrf) return c.json({ error: 'Invalid request token' }, 403);
  c.set('account', session.user);
  await next();
};
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const session = readSession(c);
  if (!session) return c.json({ error: 'Sign in required' }, 401);
  if (session.user.role !== 'admin') return c.json({ error: 'Administrator permission required' }, 403);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.header('X-CSRF-Token') !== session.csrf) return c.json({ error: 'Invalid request token' }, 403);
  c.set('account', session.user);
  await next();
};

export async function provisionAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!email || !password || password.length < 12 || password.length > 128) throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of 12-128 characters together');
  if (getDatabase().prepare('SELECT id FROM users WHERE email=?').get(email)) return;
  getDatabase().prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(randomUUID(), email, 'Administrator', await hashPassword(password), 'admin', new Date().toISOString());
  audit(null, 'admin.provision', email);
}
