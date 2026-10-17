const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function run(task, argument, database) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'database.cjs'), task, argument], { cwd: root, stdio: 'inherit', env: { ...process.env, DATABASE_PATH: database } });
    child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Database ${task} failed`)));
  });
}
async function main() {
  const directory = path.join(root, '.build/database', require('node:crypto').randomUUID());
  await fs.mkdir(directory, { recursive: true });
  const original = path.join(directory, 'original.sqlite');
  const backup = path.join(directory, 'backup.sqlite');
  const restored = path.join(directory, 'restored.sqlite');
  process.env.DATABASE_PATH = original;
  const { getDatabase, closeDatabase } = await import(pathToFileURL(path.join(root, 'apps/api/dist/services/database.js')).href);
  const db = getDatabase();
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run('restore-user', 'restore@example.test', 'Restore test', 'test-fixture-hash', 'user', new Date().toISOString());
  db.prepare('INSERT INTO library VALUES(?,?,?,?,?)').run('restore-user', 'watchlist', 'restore-title', JSON.stringify({ id: 'restore-title', title: 'Restore test', type: 'movie' }), new Date().toISOString());
  closeDatabase();
  await run('backup', backup, original);
  await run('restore', backup, restored);
  const reopened = new DatabaseSync(restored, { readOnly: true });
  try {
    assert.equal(reopened.prepare('SELECT count(*) count FROM users WHERE id=?').get('restore-user').count, 1);
    assert.equal(reopened.prepare('SELECT count(*) count FROM library WHERE user_id=?').get('restore-user').count, 1);
    assert.ok(reopened.prepare('SELECT count(*) count FROM media').get().count > 0);
  } finally { reopened.close(); }
  await fs.writeFile(path.join(root, '.build/database/restore-test.json'), JSON.stringify({ passed: true, checks: ['schema integrity', 'account persisted', 'owned library persisted', 'catalog persisted', 'backup restored into a new target'] }, null, 2));
  console.log('Database restart, backup, and restore rehearsal passed.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
