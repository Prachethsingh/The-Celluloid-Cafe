const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync, backup } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const live = path.resolve(root, process.env.DATABASE_PATH || 'data/platform.sqlite');

function verify(filename) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Database integrity check failed');
    const version = Number(db.prepare('SELECT max(version) version FROM migrations').get().version);
    if (![1, 2].includes(version)) throw new Error('Unsupported database schema version');
    for (const table of ['users', 'sessions', 'library', 'media', 'sources', 'audit', 'jobs']) db.prepare(`SELECT count(*) FROM ${table}`).get();
  } finally { db.close(); }
}

async function main() {
  const task = process.argv[2];
  const supplied = process.argv[3];
  if (task === 'backup') {
    const destination = path.resolve(supplied || path.join(root, 'data/backups', new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite'));
    if (fs.existsSync(destination)) throw new Error('Backup destination already exists');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    verify(live);
    const db = new DatabaseSync(live, { readOnly: true });
    try { await backup(db, destination); } finally { db.close(); }
    verify(destination);
    console.log(`Verified database backup: ${destination}`);
  } else if (task === 'verify') {
    verify(path.resolve(supplied || live)); console.log('Database integrity and schema verified.');
  } else if (task === 'restore') {
    if (!supplied) throw new Error('Provide the backup filename');
    if (fs.existsSync(live) || fs.existsSync(live + '-wal') || fs.existsSync(live + '-shm')) throw new Error('Stop the API and archive its current database files first. Restore never overwrites an existing database.');
    const source = path.resolve(supplied); verify(source);
    fs.mkdirSync(path.dirname(live), { recursive: true });
    fs.copyFileSync(source, live, fs.constants.COPYFILE_EXCL); verify(live);
    console.log(`Restored verified database: ${live}`);
  } else throw new Error('Use backup, verify, or restore');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
