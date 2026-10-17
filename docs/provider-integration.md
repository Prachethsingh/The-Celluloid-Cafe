# All-provider integration

## Troubleshooting an unavailable title

The main catalog is synchronized from Cinemeta and includes only metadata returned by that upstream source. An artwork placeholder means the selected record has no usable image URL; it does not establish a player failure. Matching metadata artwork returned by the detail lookup is displayed and carried into playback.

Series Play opens the episode chooser before requesting a source. Episode selections retain the season number for compatible resolvers and resume. Series with no episode data offer provider browsing. Source failures show their first diagnostic immediately and offer a provider-browsing action; retrying cannot create a missing title identity or media source.

The old development database contained sample `oceans.mp4` URLs assigned to commercial titles. Startup now removes those known sample sources and records explicitly tagged `demo-seed`; the local persistent database was backed up before cleanup. Catalog IDs alone do not establish playback rights. Playback uses configured title-specific sources or a provider link the user explicitly selected; it does not automatically search unrelated scrapers when a title has no source.

The vendored manifest contains 57 providers, compiled into 285 original modules. `/api/v1/vega/providers` reports each provider's actual built modules and readiness. The provider workspace lists all entries, allows connection checks and local enabling/disabling, and retains the priority order for compatible stream resolvers. Upstream-disabled entries remain identified; their presence does not imply online availability.

Use **Providers → Browse provider titles**: choose a provider, load categories, browse or search, select a title, then choose its direct playback link or load its season episodes. The app passes that selected link to the original provider's stream module in the isolated Vega sandbox. It does not send an IMDb ID to unrelated page-based scrapers. Hashes of provider/page links produce stable library identities; viewing checkpoints retain the selected episode and provider links for resumption. `moviesApi` has only a stream module and is used for compatible confirmed TMDB identities rather than shown as a browsing catalog.

The advanced runner exposes the original catalog, posts, search, metadata, episodes, stream, and settings operations. Supported operations depend on the modules in the selected provider. Browsing and episode playback regression tests substitute controlled modules only in the test browser; the shipped app uses the compiled upstream code. A separate integrity test fetches every original module and checks its recorded SHA-256. Browser CORS, HTTPS requirements, native WebView/cookie verification, and unsupported media/header requirements still apply.

## Installation result

Both upstream dependency installations were attempted on 2026-10-08. Provider npm install failed with registry `EACCES` fetching `zod-4.0.2.tgz`; the native app npm ci failed with `ETIMEDOUT` fetching `zod-4.4.3.tgz`. All provider source modules build using the installed root bundler. The app sandbox remains the upstream committed generated snapshot, with `vendored-generated` recorded in its manifest. A fresh source build needs registry access and `npm run install:all`; `VEGA_REQUIRE_SOURCE=true npm run build:all` rejects the snapshot fallback.

Installation and compilation cannot establish that all 57 external sites currently work. Live movie playback and fresh native dependency installation remain unverified in this restricted network session.

Local validation passed: all 285 served module hashes, 57 registry readiness entries, original provider catalogs, and controlled title/episode/stream playback on desktop and mobile Chromium. The full check passed 18 API tests and 33 browser tests; the duplicate mobile module-serving check is skipped.
