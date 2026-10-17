# CinePulse interface audit and redesign

## Findings before implementation

The active app has hash routes for discovery, search, library, and administration, with account, title, video, and provider dialogs. React 19, Vite 8 and Lucide supply the frontend; no new UI dependency is needed. Styling mixes global tokens, a 3,600-line stylesheet with competing FLIXEO overrides, and many inline styles.

The original header lacks a product name, places five overlapping catalog filters in a floating pill, and exposes eight icon-only utilities. Discord links to a generic invite and Downloads points to a route the router does not implement. Those controls add noise and misleading workflows. The hero imitates film logos, rotates automatically, invents HD/CC badges and gives a large area to styling rather than a clear action. Repeated glass panels, cyan glows, purple gradients, capsule tabs, animation utilities and heavy shadows flatten the hierarchy. The library invents an “on hold” category from item positions. The admin interface presents database information, operational actions, source forms and records as an undifferentiated vertical block. Dialogs have inconsistent controls and focus behavior.

## Design direction

A film discovery workspace with dark ink surfaces, warm paper text, a single amber accent, compact poster shelves and editorial typography. Poster artwork provides color. Functional borders and spacing replace glows and decorative effects. Navigation exposes the actual application sections; account and operational utilities are secondary. Discovery remains visually rich, search concentrates on filters/results, library on saved titles and viewing history, and admin on operational data and source management.

## System and implementation

Tokens define type, semantic colors, spacing, radii, borders and a single dialog shadow. Shared buttons, form controls, panels, tables, badges, notices and dialog surfaces use those tokens. A final design stylesheet is the explicit migration layer over the legacy selectors; existing business logic stays reviewable. Future component extraction should remove superseded legacy styles rather than add more competing themes.

Accessibility includes visible focus, adequate contrast, 40px standard controls, a skip link, dialog focus trapping and return, no automatic carousel motion, reduced motion, named navigation and controls, and responsive reflow. Honest provider errors and source selection remain part of the interface.

External poster hosts are blocked in this workspace; missing artwork needs a deliberate title placeholder, not broken image text. Production screenshots and live-provider availability require accessible hosts. A public TLS certificate and complete registry installs remain environment-dependent release checks.

The implemented header has a visible CinePulse identity and named Discover/Search/Library destinations; mobile uses four actual destinations. The spotlight is manually selected and drops unverified quality/caption badges. One full catalog grid replaces duplicate recommendation/top-five sections. Search has its own heading, labeled filters, and results toolbar. Library completion uses actual recorded progress; fabricated on-hold/drop counts, hardware claims, and default 40% progress were removed. Confirmed local backup restore now writes validated records and updates the visible library, and cannot overwrite a signed-in account. Admin uses shared panels and semantic tables around real jobs and sources. Provider management uses the same controls with 57 selectable providers, module readiness, connection checks, and separate browsing, priority, and advanced-operation views.

Design references are `apps/web/src/design-system.css` (semantic tokens and component styles) and `apps/web/src/components/ui.jsx` (page headings, panels, tables). Before/after and screen captures are stored under `.build/design/`. They use title placeholders where remote artwork cannot load.

## Interaction and responsive refinement

The follow-up order is state behavior, keyboard accessibility, then responsive visual review. Search now separates pending, failed, empty, and populated results; errors offer a retry. Pagination requests are aborted on query changes and unmount, and stale responses cannot append to a newer search. Shared feedback, loading, and empty-state components avoid separate styling conventions. Provider categories have their own ready message rather than reporting an empty title search. Administration distinguishes its initial loading state from restricted access.

Poster actions reveal on keyboard focus; saved controls expose their pressed state. Search filters expose expanded/selected state, and dialog focus traversal includes visible textareas and summary controls. One primary system font is used throughout with monospace reserved for technical output. Motion is limited to control feedback and a loading indicator, with reduced-motion support.

The screenshot review covers discovery, search, library, administrator operations, provider browsing, and account dialogs at 390, 768, 1280, and 1600 pixels. Page overflow is checked at capture time. Tablet review identified duplicate navigation; the mobile navigation now ends at the same 760px breakpoint as the desktop navigation change. Captures are available under `.build/design/` using `final-`, `search-`, `library-`, `admin-`, `providers-`, and `account-` prefixes and `mobile`, `tablet`, `laptop`, or `desktop` suffixes.

These checks cover the implemented workflows and accessibility improvements; they are not a complete WCAG certification or proof that external movie hosts are available.

Final verification on 2026-10-08 passed strict lint, API type checking, 18 API tests, all 285 modules from 57 providers, sandbox/API/web builds, and database restart/backup/restore. The final browser run passed 37 desktop/mobile Chromium checks with one intentionally skipped duplicate module-integrity check and no failures. This includes the new pending/error/retry/empty search workflow and keyboard-visible poster actions. All 24 responsive screenshots completed with no horizontal page overflow.

## Earlier baseline verification

On 2026-10-08, lint, API type checking, 18 API tests, all provider/runtime/API/web builds, and the database backup/restore rehearsal passed. Browser checks passed 33 tests across desktop and mobile Chromium. One duplicate mobile module-integrity check is intentionally skipped because module serving is independent of viewport; all 285 original modules were checked in the desktop run. The controlled provider flow and local library restore pass on both viewports. Desktop and mobile screenshots cover discovery, search, library, authenticated administration, providers, and account dialogs. Public deployment, live provider movie playback, and fresh registry installations remain unverified.
