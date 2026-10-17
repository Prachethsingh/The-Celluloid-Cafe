const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { importMedia } = require('./import-media.cjs');

test('local import binds files to exact titles, rejects invalid input and rolls back a failed batch', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-import-'));
  const databasePath = path.join(dir, 'test.sqlite');
  const mediaDirectory = path.join(dir, 'media');
  const file = path.join(dir, 'header-only.webm');
  // Header-only unit fixture is not represented as a decodable video.
  fs.writeFileSync(file, Buffer.from('1a45dfa30000000000000000', 'hex'));
  const db = new DatabaseSync(databasePath);
  try {
    db.exec('CREATE TABLE media(id TEXT PRIMARY KEY,type TEXT,title TEXT,data TEXT); CREATE TABLE sources(id TEXT,content_id TEXT,type TEXT,episode_id TEXT,url TEXT,name TEXT,format TEXT,provenance TEXT,created_at TEXT);');
    const movie = { id: 'owned-01', title: 'Owned film', file, provenance: 'Unit fixture' };
    const options = { databasePath, mediaDirectory };
    assert.throws(() => importMedia({ movies: [movie] }, options), /permission/);
    const imported = importMedia({ rights_confirmed: true, movies: [movie] }, options);
    assert.equal(imported[0].content_id, movie.id);
    assert.ok(fs.existsSync(path.join(mediaDirectory, path.basename(imported[0].url))));
    assert.equal(db.prepare('SELECT title FROM media').get().title, movie.title);
    assert.throws(() => importMedia({ rights_confirmed: true, movies: [{ ...movie, id: 'owned-02' }, { ...movie, title: 'Wrong title' }] }, options), /identity mismatch/);
    assert.equal(db.prepare('SELECT count(*) n FROM media').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) n FROM sources').get().n, 1);
    assert.equal(fs.readdirSync(mediaDirectory).length, 1);
    fs.writeFileSync(file, 'not a video container');
    assert.throws(() => importMedia({ rights_confirmed: true, movies: [movie] }, options), /header/);
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});