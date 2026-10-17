# Reliable playback with operator-owned media

The scraper catalog is not a media library. Installing provider modules or an
Android APK does not guarantee a playable stream for a catalog title.

The local importer copies MP4/WebM files into the existing media server and
registers title-specific sources. No new service, paid account, or Android
runtime is required. Use only media you have permission to host.

1. Start the API once to initialize its database.
2. Create a JSON manifest with `rights_confirmed: true` and a `movies` array.
   Every movie needs `id`, `title`, `file` (an absolute path), and `provenance`.
   Use the exact existing catalog ID/title for an existing film. For your own
   films use unique IDs such as `owned-film-01`. Do not map another film to
   Interstellar or any unrelated catalog title.
3. From the repository root run `npm run media:import -- C:\absolute\path\movies.json`.
   The command reads the root `.env`, including `DATABASE_PATH` and
   `MEDIA_DIRECTORY`, just like the local server launcher.
4. Refresh the website, search the imported title and press Play. Enable
   **Autoplay next** to search subsequent catalog titles when it ends.

The current next-title queue is ordered by catalog ID, not import time.
Contiguous IDs make a simple playlist for operator-imported films. New imports
do not overwrite existing sources or original files. Failed batches roll back
database changes and remove copies created by that batch. An interrupted process
can leave orphan copies; inspect the media directory before removing any files.

## Limits

- Container signatures are checked, not codecs. Verify actual playback in your
  target browser; an MP4 container alone does not guarantee supported codecs.
- Copies require additional disk space. The original files are never moved.
- `/media` is currently public to clients who can reach the server. This is not
  DRM, subscription enforcement, or a private-video hosting solution.
- The importer is an operator CLI, not a public upload endpoint.
- No licensed commercial film, external streaming subscription, debrid account,
  or native Vega runtime is supplied by this feature.

Run `npm run test:media` for importer checks. The `owned-playback.spec.js` browser
test imports two explicitly named local test clips into an isolated database,
uses real API routes, checks decoded video, and waits for natural completion and
the next clip. That proves the local playback pipeline, not commercial content
availability.