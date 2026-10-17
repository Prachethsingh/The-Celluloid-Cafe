# Crowra scan fixes

Implemented shared platform label colors and brighter muted text, 28px carousel targets, a 24px minimum for buttons, explicit image dimensions, browser zoom, a keyboard skip link, visible project attribution, and honest FAQ answers. Open Graph tags, canonical origin and matching WebApplication/FAQPage JSON-LD are generated into HTML, without requiring client rendering. FAQ text and markup use the same source file.

Publication dates are not invented for the application. The attribution identifies project contributors, not a fabricated article author. These advisory scan items require editorial decisions rather than false data.

The pasted plan hides two items behind “Show 1 more”; their details were not supplied. Those items and the original 87/100 score cannot be confirmed resolved from this excerpt.

## Validation

Completed on 2026-10-08: lint, type checking, 18 API tests, all builds, database restore rehearsal, and 28 desktop/mobile Chromium tests passed. Public-origin metadata generation and rejection of insecure public metadata URLs also passed.

The full local check runs lint, API type checking, 18 API tests, all package/app builds, a database restart/backup/restore rehearsal, and desktop/mobile Chromium tests. A dedicated browser regression verifies JSON-LD/visible FAQ agreement, served social image, canonical/OG tags, skip-link keyboard focus, HTML image dimensions, carousel/tab target sizes, and platform text contrast of at least 4.5:1. This covers the reported shared components, not a full WCAG audit of every state.

If development services occupy the default ports, set `E2E_API_PORT` and `E2E_WEB_PORT` to free ports before running checks. This run uses 18080 and 18573 and leaves existing development services running.

## Public HTTPS deployment

Set `SITE_DOMAIN` to the actual DNS hostname (without protocol or path), `ACME_EMAIL` to a certificate contact, and `PLAYBACK_SIGNING_KEY` to a secret of at least 32 characters in your deployment environment. Point DNS to the host and allow inbound TCP 80/443 (UDP 443 is optional).

Run `docker compose -f compose.https.yml up --build -d`. This standalone production stack uses Caddy automatic certificates and HTTP-to-HTTPS redirects. API and web container ports stay internal. Certificate state and the SQLite/media directory persist in named volumes. Source rebuilds and image downloads require network access.

The frontend build receives `VITE_SITE_URL=https://<SITE_DOMAIN>/`; direct frontend builds can set this variable explicitly. Without configuration, local builds identify `http://127.0.0.1:5173/`, not an invented production domain. Hash navigation is one application document and shares its canonical root.

Confirm the valid certificate and redirect with `curl -I http://<SITE_DOMAIN>` and `curl -I https://<SITE_DOMAIN>`. Inspect the final HTML canonical/OG URLs and JSON-LD, test sign-in over HTTPS, then re-run Crowra on the public HTTPS URL. Local HTTP scan findings cannot be marked resolved by a production configuration alone.

Caddy behavior: https://caddyserver.com/docs/automatic-https

Docker/Caddy are unavailable in this session; certificate issuance and public deployment remain unverified. Crowra is not installed here, so the original score cannot be re-scanned in this workspace.
