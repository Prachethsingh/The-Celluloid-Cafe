# Live movie playback audit — 2026-10-09

Movie playback is not correctly configured. All 52 movie records return the same two sample sources, and none has a configured source for its actual movie.

## Live checks

- Queried the live catalog and each of the 52 movie source endpoints through http://127.0.0.1:5173, without mocked responses.
- Every endpoint returned HTTP 200 and two sources: `/media/oceans.mp4` and `https://vjs.zencdn.net/v/oceans.mp4`.
- Ran 52 Playwright playback attempts across the 50 distinct title names. Two duplicate title records share names, so the UI audit selected the first card for those names; the API audit checked every record by ID.
- Every UI attempt decoded the local oceans sample, with advancing playback time, a 960-pixel video width, and a duration of 46.613333 seconds. No page errors were captured.
- Read-only database inspection confirmed 52 local movie sample assignments, 52 CDN movie sample assignments, and seven episode sample assignments.
- The installed player manifest still reports Shaka unavailable. These local MP4 checks do not validate HLS/DASH playback or external provider availability.

## Cause

`scripts/seed-sources.cjs` assigns the same oceans sample to every movie and episode, labeling it as verified media. The live database contains those assignments. `resolvePlayback` returns configured sources immediately, so those sample records also prevent normal provider fallback for these titles.

This demonstrates working sample decoding, not working movie playback. The earlier isolated UI regression suite cannot certify the contents of the live catalog.

## Required repair

Replace the incorrect sample assignments with matching movie sources, or remove those assignments and configure providers with confirmed title identities and browser-playable streams. Install the missing Shaka runtime for adaptive formats. Removing samples alone will not supply the movies.

This audit made no production database or application changes.

Raw evidence: [all movie results](../.build/all-movies-results.json).
