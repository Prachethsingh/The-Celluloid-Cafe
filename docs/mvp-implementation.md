# MVP implementation and operating guide

This document supersedes the earlier prototype claims in the architecture blueprints. The active MVP uses Node.js 24, Hono, React, and a local SQLite store. PostgreSQL/Redis Compose services remain optional proposed infrastructure, not the active persistence/cache implementation.

## Playback

Selected titles first resolve configured sources from `GET /api/v1/playback/sources/:type/:id`. An administrator can add/remove a title-specific media source in the Admin Dashboard. Configure an HTTPS MP4/WebM URL or place media in `data/media` and use `/media/filename.mp4`. The media endpoint supports byte ranges for seeking. Only configured public media belongs in this directory; do not place private uploads or account files there.

If no configured source exists, playback remains unavailable unless the user explicitly selected a provider title/stream in the provider browser or a previously connected add-on. Catalog IMDb/TMDb identities do not trigger automatic scraper or add-on searches. It does not guess a replacement title, choose arbitrary search results, or construct unrelated sample-media fallbacks.

The player uses actual decoded media, native controls, supported subtitle tracks, actual duration, speed controls, and periodic resume persistence. Unavailable, failed, or unsupported sources produce explicit errors. HLS currently requires native browser support; an HLS JavaScript decoder is not available in the local package cache. Header-protected upstream streams and providers requiring native cookies/WebViews may not work in a browser. All-provider playback has not been verified.

The production catalog is synchronized from Cinemeta; it does not include bundled demo title records. Platform availability is unverified unless explicitly marked otherwise. Language, quality, DRM guarantees, and subtitle tracks are not inferred from a metadata record. Browser regression tests register an explicitly named encoded fixture in an isolated test database; those tests do not establish actual commercial film playback.

## Accounts and administration

Public discovery works without an account. Registration/login verify passwords server-side using scrypt with a random salt. The API stores hashed opaque session tokens; the browser receives an HttpOnly SameSite cookie and a per-session CSRF token. Production cookies require HTTPS. Logout revokes the session; admin mutations require both administrator role and the CSRF token. User library operations are scoped to the signed-in account.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before first startup to provision an administrator. No default administrator password exists. The password must contain 12-128 characters. Provisioning does not silently reset an existing account's password or elevate an existing ordinary account.

Signing in loads the account's library; anonymous saved data stays local until sign-in replaces the local view with server account data. Account sign-out clears the device's account library view. Sync failures are surfaced in the UI. Account export omits credential/session secrets, and account deletion requires password confirmation and deletes owned sessions/library rows.

Password changes verify the current password and rotate the session while revoking other sessions. The account view lists/revokes owned active sessions. Email verification, email-based password recovery, MFA, OAuth/SSO, and payment/tenant workflows are not implemented. They require additional product decisions and service integration; the UI does not claim they exist.

Admin health uses actual stored counts and database state. Catalog synchronization is a real bounded upstream fetch and transaction with persisted job state and audit events; failures report failure and retain the previous catalog. It does not invent successful database/cache metrics.

The API performs one live catalog sync at startup, then refreshes every 15 minutes by default. Set `CATALOG_SYNC_INTERVAL_MS` to at least 60000 milliseconds to change the interval; `VEGA_OFFLINE=true` disables synchronization. Web and mobile clients refresh the catalog every minute and when returning to the foreground.

## Persistence and configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_PATH` | SQLite filename; default `data/platform.sqlite` |
| `MEDIA_DIRECTORY` | Public configured media directory; default `data/media` |
| `PLAYBACK_SIGNING_KEY` | Required in production, at least 32 characters; ephemeral random development key otherwise |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | One-time explicit administrator provisioning |
| `ALLOWED_ORIGINS` | Comma-separated browser origins; defaults to local Vite origins |
| `PORT` | API port; default 8000 |
| `VITE_API_BASE_URL` | Web API base; default same-origin `/api/v1` |
| `EXPO_PUBLIC_API_BASE_URL` | Absolute API URL reachable from the mobile device |
| `API_PROXY_TARGET` | Local Vite proxy target; default `http://127.0.0.1:8000` |
| `VEGA_REQUIRE_SOURCE` | Set `true` to reject the generated-runtime fallback during builds |
| `CATALOG_SYNC_INTERVAL_MS` | Live catalog refresh interval; default 900000, minimum 60000 |

The database initializes versioned schema, constraints, and indexes with an empty catalog. The API fills it from live upstream metadata at startup. Existing legacy endpoints read the same live database; `/catalog` is the current paged/filterable discovery contract.

SQLite is suitable for this single-node MVP. A database volume must persist `/app/data` in containers. Horizontal scaling, managed PostgreSQL migration, cross-node rate limiting, and a persistent distributed queue require further deployment work. Rate limits currently apply in process and are not a cluster-wide guarantee.

## Backup and restore

```sh
npm run db:backup -- data/backups/platform.sqlite
npm run db:verify -- data/backups/platform.sqlite
```

Backup uses SQLite's consistent backup API, then checks integrity/schema. Treat backups as sensitive account data: use private storage, restrictive access, encryption supplied by the storage environment, off-site copies, and an agreed retention policy. These storage arrangements are not provisioned by the CLI.

To restore, stop the API, archive the existing database and its WAL/SHM files, then run `npm run db:restore -- data/backups/platform.sqlite`. Restore checks the backup and refuses to overwrite any existing database files. Set `DATABASE_PATH` to restore into an isolated target for a rehearsal. Confirm readiness, account login, library data, and source inventory before routing traffic back. Assign RPO/RTO and incident owners before production.

## Release gates

The [OpenAPI contract](api/openapi.json) documents the active account/library/catalog/source/admin endpoints. Regenerate it with `node scripts/build-api-contract.cjs`. The legacy API reference describes prototype behavior and is marked accordingly.

On 2026-10-11, 24 API tests and 61 desktop/mobile Chromium E2E tests passed, along with production build, lint, and typecheck. A fresh catalog title without a configured source returned unavailable and made no automatic provider resolver requests. A database backup was verified before startup cleanup; the live sync completed with 166 records.

Local lint/typecheck/API/browser checks and backup rehearsals validate application behavior, not hosting availability. Network restrictions still prevent fresh upstream installation and actual remote film playback acceptance. Docker/remote CI, deployed HTTPS, remote backups, alerts, and production rollback remain unverified. Use [the checklist](feature-checklist.md) to track these external and deferred gates.
