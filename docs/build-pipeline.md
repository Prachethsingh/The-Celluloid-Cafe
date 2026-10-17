# Build and integration pipeline

The root pipeline coordinates the webapp, API, and the two existing Vega repositories. It retains separate dependency trees to avoid mixing web React and native React versions.

1. `install:deps` runs `npm ci` for the root, API, and webapp.
2. `install:all` additionally installs the upstream provider dependencies and Vega app lockfile. Native install hooks are skipped because this pipeline builds the JavaScript sandbox, not Android/iOS applications. The provider repository's incomplete optional native dependency lock entries are repaired by `npm install`.
3. `build:clean` safely removes fixed generated directories, compiles every available module for all manifest providers, builds the Vega sandbox, compiles the API, and produces the Vite frontend.
4. `check:clean` adds strict lint, API typechecking, API tests, database restart/backup/restore checks, and desktop/mobile Chromium integration tests.

| Artifact | Source | Consumer |
| --- | --- | --- |
| `.build/vega-providers` | Vendored provider TypeScript, manifest, URL map | API module endpoints and web sandbox |
| `.build/vega-app` | Upstream worker/document source, or its committed generated snapshot | API runtime endpoint and isolated browser iframe |
| `apps/api/dist` | Hono API TypeScript | Node production server and API Docker image |
| `apps/web/dist` | React/Vite frontend | Static hosting and web Docker image |
| `.build/catalog/catalog.json` | Empty initial snapshot; live Cinemeta sync is performed by the API | Persistent catalog initialization |

`GET /api/v1/vega/build` exposes build provenance. Provider/module requests use manifest and module allowlists. Repository discovery is independent of the server's working directory. The browser bridge uses a per-host channel and iframe source checks; native-only operations fail explicitly.

Local browser tests automatically start the services. Windows launches Node directly and stops the owned services through per-run token-protected test endpoints, avoiding restricted command-shell process tree termination. These endpoints exist only when the test service launcher receives the token. Linux CI uses Playwright's web server management. Browser exceptions fail tests.

The browser suite covers proxy health, responsive catalog layout, search and empty results, metadata, persistent country selection, persistent watchlist changes, profile navigation, provider build availability, admin rendering, decoded playback, the upstream provider sandbox catalog, and media errors. It uses deterministic offline catalog responses and a locally encoded video fixture. It does not verify third-party live stream access.

## Environment limits

Local MVP validation on 2026-10-08: `check:clean` completed with exit code 0, zero lint warnings, successful API typechecking, 18 passing API tests, 26 passing desktop/mobile Chromium tests, and a successful database restart/backup/restore rehearsal. All 285 provider modules across 57 providers, the generated upstream sandbox, API/web production outputs, and 56 demo metadata records rebuilt successfully. Playback fixture tests now use registered title-bound sources and the actual media endpoint; no CDN interception is used in the successful decode test.

Live-catalog readiness validation on 2026-10-11: the API synchronized 166 Cinemeta records on startup; the persistent SQLite catalog contained zero `demo-seed` records and zero sample playback sources. The current build, lint, API typecheck, 24 API tests, and 61 desktop/mobile Chromium E2E tests passed (one provider-integrity mobile duplicate is skipped). Playback tests require configured title-bound sources or an explicitly selected provider; unconfigured catalog titles do not trigger automatic scraper requests.

Core dependencies were successfully reinstalled from the existing npm cache. Registry/GitHub access from the execution environment is blocked; complete upstream dependency installation and a fresh Vega app source rebuild could not be completed locally. The sandbox build manifest records use of the upstream generated snapshot instead. CI's upstream build uses `VEGA_REQUIRE_SOURCE=true` so it cannot silently use that fallback.

Docker is not installed in this environment. Dockerfiles and GitHub Actions are prepared, but container builds and remote CI execution have not been verified locally. Native binaries, Expo device execution, and the legacy Python backend are outside the agreed scope. The active MVP now has SQLite persistence; PostgreSQL/Redis integration remains proposed.

The latest local check results are recorded in `.build/e2e/results.json`; generated outputs and reports are ignored by version control. Run `npm run check:clean` to reproduce validation from empty build directories.
