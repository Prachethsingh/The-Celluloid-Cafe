# Content and playback quality audit

## Priorities and causes

1. The seed assigned unrelated Unsplash photos to film posters, backdrops, cast, and episodes. These URLs are removed from both frontend seed files and the legacy API seed. API reads sanitize existing demo database rows without changing their IDs or deleting users, libraries, or configured sources.
2. The detail dialog falsely claimed daily availability verification, linked a sample movie as a trailer, and advertised subtitle readiness. These claims and the sample episode fallback are removed. Demo artwork, ratings, and platform availability are not presented as verified data.
3. The video player used source discovery as its readiness signal. Playback status now comes from browser media events. Errors override paused/buffering state, and a retry remounts the media element. Returned provider streams are validated and deduplicated by URL. Source discovery is not evidence of access rights or successful playback.
4. Mobile details placed a full poster and empty 360px banner before the title. The mobile dialog now puts the title/actions first, followed by compact facts/artwork. Missing banners reserve only enough room for controls. Catalog columns have a 195px minimum, producing approximately five or six desktop columns.

## Implemented behavior

`Artwork` reserves a 2:3 poster or 16:9 backdrop area and handles loading, loaded, missing, and failed images. A failed image is removed rather than exposing broken-image alt text. The text fallback is explicitly marked unavailable and clamps long titles inside the image area. Metadata lives below the poster, independently of controls. Stock images are rejected even in old device history.

Catalog synchronization accepts IMDb ID records and uses artwork URLs from the same upstream record. It rejects malformed identity records and omits missing years, ratings, and images instead of manufacturing defaults. These records have explicit metadata/artwork provenance. Stable demo IDs remain unchanged, and legacy movie/series lookup URLs remain supported.

The player distinguishes source lookup, connecting, buffering, playing, paused, finished, and failed states. Network and decode errors use the browser's actual error category; the browser may not expose the precise HTTP reason for a remote media failure. Unauthorized playback-service responses have their own message. Playback settings list only returned sources and playback speeds; no automatic/4K choice is invented. Another-source recovery is offered when multiple sources exist. Native accessible video controls remain available.

Media error categories follow [MDN's MediaError documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaError/code).

The footer has navigation and truthful About/attribution, privacy/device-data, usage/playback, support, and FAQ disclosures. It does not fabricate a support email, subscription plan, or legal certification.

## Verification and limits

Final local validation on 2026-10-08: strict lint and type checking passed; 21 API tests passed; 41 desktop/mobile Chromium checks passed with one intentional duplicate integrity check skipped, zero unexpected failures, and zero flaky results. All 57 providers/285 modules, the committed Vega sandbox, API, and web built successfully. Database restart/backup/restore passed. Forty screenshots completed across ten screens/states at four sizes with no horizontal page overflow. The final API identity-validation refinement was separately type-checked, tested, and rebuilt after the browser run.

Screenshots include `.build/design/detail-mobile.png`, `player-mobile.png`, `player-error-mobile.png`, `final-desktop.png`, and their tablet/laptop/desktop variants. The player capture visibly labels the encoded fixture as a CinePulse test video. Production JavaScript is 443.99 kB (119.65 kB gzip); no new runtime dependency was installed. This is a build measurement, not a production load-test result.

| Audit area | Verified result | Remaining limitation |
| --- | --- | --- |
| Movie/poster association | Removed unrelated stock assignments; upstream records and detailed metadata require stable IMDb identities | Actual poster delivery needs reachable metadata/artwork hosts |
| Missing/broken artwork | Missing/failed states, removed failed image, contained long-title fallback, fixed ratios | Genuine remote artwork is unavailable here |
| Ratings and service claims | Demo ratings/availability omitted; false daily verification/subtitle claims removed | Demo descriptions and future-release records remain explicitly unverified |
| Playback | Real fixture decoded and time advanced; failures never reported Ready; retry recovered | Commercial movie/provider playback remains unverified |
| Source selector | Valid returned choices, URL deduplication, concise capability labels, accessible settings | Reported quality is provider metadata, not independently measured resolution |
| Layout and footer | Four viewport sizes; compact mobile details; consistent grid and honest informational disclosures | No public production deployment performed |

API tests exercise removal of misleading demo fields and upstream ID/missing-field validation. Browser tests exercise missing/failed artwork, long-title bounds, actual video decoding/time advancement, failed-playback status, and retry recovery alongside navigation, filtering, account, library, and provider workflows. Screenshot capture covers discovery, search, library, administration, providers, account, details, player settings, playback failure, and footer at 390, 768, 1280, and 1600 pixels, checking page overflow at each capture.

The screenshot movie player uses the clearly labeled encoded local test fixture. It is not a streamed commercial movie. A fresh Node fetch to `https://v3-cinemeta.strem.io/meta/movie/tt0816692.json` failed with `EACCES`; the same endpoint was inaccessible through the available web reader. Correct real poster delivery and live provider playback therefore remain unverified release checks. The app uses an honest unavailable-artwork state rather than unrelated stock photos. The existing catalog is still explicitly a demo collection; this work does not certify all demo descriptions or future-release records as factual.
