# CinePulse platform

React/Vite webapp, Hono API, and the existing vendored Vega repositories share one build and test pipeline. Scope covers the webapp, API, all Vega provider modules, and the Vega app sandbox runtime. Android/iOS binaries and the legacy Python backend are outside this pipeline.

Use Node.js 24 LTS and npm. Run commands from this directory:

```sh
npm run install:deps
npm run install:player
npx playwright install chromium
npm run check:clean
npm run dev
```

The webapp runs at http://127.0.0.1:5173 and proxies `/api` to the API at http://127.0.0.1:8000. `npm run dev` builds the provider modules and sandbox before starting both services.

| Command | Result |
| --- | --- |
| `npm run install:deps` | Install locked root, API, and web dependencies |
| `npm run install:player` | Install pinned Shaka Player and bundle its runtime and license for adaptive playback |
| `npm run test:player` | Verify player packaging, adaptive routing, and cancellation/teardown contracts |
| `npm run test:adaptive` | Require installed Shaka and decode local DASH/WebM and HLS/fMP4 fixtures on desktop/mobile Chromium |
| `npm run install:all` | Also install both upstream Vega repositories; skip native installation hooks |
| `npm run build:clean` | Remove generated outputs and rebuild the complete scoped platform |
| `npm run build:all` | Build both Vega packages, API, and webapp |
| `npm run check:clean` | Clean, lint with warnings treated as failures, typecheck, API tests, full builds, and browser tests |
| `npm run test:e2e:all` | Additionally test Firefox and WebKit when their browsers are installed |

Build outputs are `apps/web/dist`, `apps/api/dist`, `.build/vega-providers`, and `.build/vega-app`. Provider build manifests record the SHA-256 and size of each compiled module. Cleaning removes generated builds and reports and retains dependencies and source files.

The upstream repositories remain separate packages with their own dependencies and lockfiles:

- [Zenda-Cross/vega-providers](https://github.com/Zenda-Cross/vega-providers): 57 manifest providers, compiled into 285 modules.
- [vega-org/vega-app](https://github.com/vega-org/vega-app): its original worker/document sandbox, hosted inside an isolated iframe in the webapp.

After `npm run install:all`, the sandbox builds from its original TypeScript sources. When upstream dependencies are unavailable, it packages the upstream committed generated runtime; the output manifest explicitly records `vendored-generated`. Set `VEGA_REQUIRE_SOURCE=true` to require a fresh source build. CI requires this mode for its upstream package job.

The Providers sandbox runs original catalog, posts/search, metadata, stream, episodes, and settings modules through the API-served bundles. Provider requests follow browser CORS rules. Providers requiring native WebView verification, cookie extraction, or unsupported crypto operations report an error. Compilation does not establish that every third-party service is online.

The application has a persistent SQLite account/library store and a live Cinemeta catalog sync. The API synchronizes on startup and every 15 minutes by default; set `CATALOG_SYNC_INTERVAL_MS` to a value of at least 60000 milliseconds or set `VEGA_OFFLINE=true` to disable upstream sync. The web and mobile clients refresh catalog data every minute and when returning to the foreground. For mobile devices, set `EXPO_PUBLIC_API_BASE_URL` to an absolute API URL reachable from that device (for example, the development machine's LAN address rather than `localhost`).

The player never substitutes sample films or fabricates tracks/DRM. Playback requires a configured, title-specific media source; metadata synchronization does not grant streaming rights or provide playable media. Actual remote movie playback remains unverified until an operator configures an authorized source and tests it from the target network. Browser tests register explicitly labeled media fixtures in isolated test databases. Admin synchronization records upstream failures and retains the last successful catalog.

GitHub Actions in `.github/workflows/ci.yml` install dependencies, audit application packages, run checks, build both upstream packages, retain artifacts/reports, and build the API/web Docker images without publishing them. `docker compose up --build` requires a production signing key and uses the root compose file and same-origin Nginx API/media routing. SQLite persists in the API data volume; optional PostgreSQL/Redis services are not used by the MVP.

See [build pipeline details](docs/build-pipeline.md) for validation and environment limits. Vega licensing remains governed by the upstream LICENSE/NOTICE files.

For public HTTPS, use the standalone `compose.https.yml` stack with your DNS domain and certificate contact. See [scan fixes and HTTPS deployment](docs/scan-fixes.md) for environment settings, metadata URLs, and verification steps.

See the [UI audit and design system](docs/design-audit.md) and [all-provider integration guide](docs/provider-integration.md). Provider browsing follows the original catalog → title → episode → stream flow and reports real errors when an upstream operation fails.

See [MVP setup and source configuration](docs/mvp-implementation.md) and [the full-stack gap checklist](docs/feature-checklist.md). Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before initial startup to provision an administrator; no default administrator password exists. Configure your title-specific media in the Admin Dashboard. `npm run db:backup` and `npm run db:verify` provide consistent backup and integrity checks.

See [open-source provider and player integrations](docs/open-source-integrations.md) for the shared Vega/Stremio adapter boundary, add-on connection workflow, supported media, licenses, and remaining live-playback validation. Shaka installation requires registry access; builds without it retain native playback and report adaptive playback as unavailable.
