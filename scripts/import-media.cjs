const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');

// Operator-only local import. No public endpoint accepts server file paths.
function importMedia(manifest, options = {}) {
  if (!manifest || manifest.rights_confirmed !== true) throw new Error('Confirm that you have permission to host this media with rights_confirmed: true.');
  if (!Array.isArray(manifest.movies) || !manifest.movies.length || manifest.movies.length > 100) throw new Error('Provide between 1 and 100 movies.');
  const ids = new Set();
  const entries = manifest.movies.map(movie => {
    if (!movie || typeof movie.id !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(movie.id) || ids.has(movie.id)) throw new Error('Movie IDs must be unique and contain only letters, digits, underscores or hyphens.');
    ids.add(movie.id);
    if (typeof movie.title !== 'string' || !movie.title.trim() || movie.title.length > 200) throw new Error('Each movie needs its correct title.');
    if (typeof movie.provenance !== 'string' || !movie.provenance.trim() || movie.provenance.length > 500) throw new Error('Each movie needs its source/permission provenance.');
    if (typeof movie.file !== 'string' || !path.isAbsolute(movie.file)) throw new Error('Use an absolute local media file path.');
    const stat = fs.lstatSync(movie.file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 12) throw new Error('Media must be a nonempty regular file, not a symbolic link.');
    const format = path.extname(movie.file).slice(1).toLowerCase();
    if (!['mp4', 'webm'].includes(format)) throw new Error('Only MP4 and WebM files are supported.');
    const header = Buffer.alloc(12);
    const fd = fs.openSync(movie.file, 'r');
    try { fs.readSync(fd, header, 0, 12, 0); } finally { fs.closeSync(fd); }
    if (format === 'mp4' ? header.toString('ascii', 4, 8) !== 'ftyp' : header.readUInt32BE(0) !== 0x1a45dfa3) throw new Error('File header does not match its media format.');
    return { ...movie, title: movie.title.trim(), format };
  });
  const databasePath = path.resolve(root, options.databasePath || process.env.DATABASE_PATH || 'data/platform.sqlite');
  if (!fs.existsSync(databasePath)) throw new Error('Start the API first to initialize its database.');
  const directory = path.resolve(root, options.mediaDirectory || process.env.MEDIA_DIRECTORY || 'data/media');
  fs.mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(databasePath);
  const copied = [];
  const result = [];
  let transaction = false;
  try {
    db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
    transaction = true;
    for (const movie of entries) {
      const existing = db.prepare('SELECT type,title FROM media WHERE id=?').get(movie.id);
      if (existing && (existing.type !== 'movie' || existing.title !== movie.title)) throw new Error(`Catalog identity mismatch for ${movie.id}; use its exact movie title.`);
      const sourceId = randomUUID();
      const filename = `${sourceId}.${movie.format}`;
      const destination = path.join(directory, filename);
      fs.copyFileSync(movie.file, destination, fs.constants.COPYFILE_EXCL);
      copied.push(destination);
      if (!existing) {
        const item = { id: movie.id, title: movie.title, type: 'movie', year: null, genres: [], cast: [], description: 'Operator-imported media.', metadata_provenance: 'operator-import', artwork_provenance: 'unavailable', poster_url: null, backdrop_url: null, rating: null, availability: {}, availability_verified: false };
        db.prepare('INSERT INTO media(id,type,title,data) VALUES(?,?,?,?)').run(movie.id, 'movie', movie.title, JSON.stringify(item));
      }
      const url = `/media/${filename}`;
      db.prepare('INSERT INTO sources(id,content_id,type,episode_id,url,name,format,provenance,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(sourceId, movie.id, 'movie', '', url, movie.title.slice(0, 120), movie.format, movie.provenance, new Date().toISOString());
      result.push({ content_id: movie.id, title: movie.title, url, format: movie.format });
    }
    db.exec('COMMIT');
    transaction = false;
    return result;
  } catch (error) {
    if (transaction) db.exec('ROLLBACK');
    for (const file of copied) fs.rmSync(file, { force: true });
    throw error;
  } finally { db.close(); }
}

module.exports = { importMedia };
if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error('Usage: npm run media:import -- C:\\absolute\\path\\movies.json');
    const result = importMedia(JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), 'utf8')));
    console.log(JSON.stringify({ imported: result, note: 'Container headers checked; verify decoding in the browser. Media URLs are public to users who can reach this server.' }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}