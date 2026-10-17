# CinePulse UI verification — 2026-10-09

The UI is not fully ready as a streaming site. Automated interaction checks pass, but the live development catalog has missing artwork, a confirmed title/media mismatch, an unavailable adaptive player, and a navigation scroll issue.

## Test results

- Full Playwright suite: **53 passed, 0 failed, 1 intentional skip, 0 flaky** across desktop and mobile Chromium, in 115.7 seconds. The skip is the duplicate mobile provider-module integrity check.
- Live application inspected without mocked catalog/source responses at 1440×900, 768×1024, and 390×844. Home, series details, playback, library, providers, add-ons, and account screens were exercised.
- No JavaScript page errors and no horizontal page overflow across those 21 captured states.
- The provider registry loads all 57 providers. Native MP4 decoding works. Series Play opens the episode chooser.
- Automated account, watchlist, search/filter, focus management, source error recovery, episode identity/resume, and controlled provider/add-on flows pass. Fixture-based stream checks do not establish availability of the corresponding commercial films.

## Confirmed issues

| Priority | Finding | Evidence / effect |
| --- | --- | --- |
| High | The selected film and media do not match | Opening **Interstellar** resolves `/media/oceans.mp4`, a 46-second oceans clip. It decodes on all three viewport configurations, but is not the selected film. The existing source seed script assigns the same sample URL to multiple titles. |
| High | Catalog artwork is missing | All 56 visible catalog records have zero poster images in the rendered cards. The records are demo metadata and display artwork placeholders. |
| High | Adaptive playback remains unavailable | `apps/web/public/vendor/player-manifest.json` reports `available: false`. Real Shaka HLS/DASH decoding cannot pass until its runtime is installed. |
| Medium | Library navigation retains the previous scroll position | On mobile, scroll to the bottom of Home and press the fixed Library navigation button. The URL changes to `#library`, but scroll position remains 984px and the library heading is at −811.9px, outside the viewport. `useNavigation` updates the tab without resetting scroll. |
| Low | Provider loading briefly looks empty | Immediately after opening the workspace, it displays “0 Providers Loaded” and “No providers match these filters” before the registry response arrives. It subsequently displays 57 providers. |

## Evidence

- [Full Playwright JSON](../.build/e2e/results.json)
- [Live UI measurements](../.build/ui-audit/results.json)
- [Navigation measurements](../.build/ui-audit/navigation.json)
- [Desktop catalog](../.build/ui-audit/desktop-home.png)
- [Incorrect Interstellar media](../.build/ui-audit/desktop-playback.png)
- [Mobile navigation issue](../.build/ui-audit/mobile-library-navigation.png)
- [Loaded mobile provider registry](../.build/ui-audit/mobile-providers-loaded.png)

The live audit used fresh browser contexts and did not change the development database or register production accounts. Firefox, WebKit, real external provider streams, and authenticated administrator workflows were not validated by this run. Development services remain running at ports 5173 and 8000.
