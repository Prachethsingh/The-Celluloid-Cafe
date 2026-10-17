# Full-stack feature checklist and project gap assessment

Assessment date: 2026-10-08. Scope: the active React webapp, Hono API, and both vendored Vega package builds. Native device binaries and the legacy Python backend are excluded. This is an evidence-based category assessment and implementation roadmap; it does not certify every item in the supplied enterprise checklist.

**Current release decision: MVP core implemented; production release not yet verified.** Title-bound source configuration/resolution, real account/session handling, server-enforced administration, persistent catalog/library data, and local checks are implemented. Actual remote film playback, deployed HTTPS, remote source/container CI, and production operations remain release gates. See [MVP implementation](mvp-implementation.md).

Status meanings:

- **Verified**: supported by a local check; the coverage boundary is stated.
- **Partial**: some source implementation exists; listed gaps remain.
- **Demo**: simulated behavior or sample data; not a production feature.
- **Planned**: requirements, schema, or configuration exist without a verified running integration.
- **Missing**: no implementation found in the inspected active app.
- **Conditional**: needs a product decision or a demonstrated use case; excluded from the proposed MVP.

An installed dependency, architecture drawing, success message, or passing fixture test does not establish that the corresponding production feature exists. Features outside the inspected scope remain unassessed.

## Evidence

| Reference | What it establishes |
| --- | --- |
| [Build pipeline](build-pipeline.md), `npm run check:clean` | Exit 0; zero lint warnings; API typechecking; 18 API and 26 desktop/mobile Chromium tests; database restart/backup/restore rehearsal; successful web/API/provider/runtime builds |
| [Browser suite](../e2e/app.spec.js) | Search, layout, country persistence, watchlist persistence, profile UI, provider builds, decoded fixture playback, sandbox catalog execution, and playback error state |
| [Actual playback attempt](../scratch/movie-playback.json) | Baseline attempt selected a sample incorrectly. After implementation, original title resolver returned unavailable under blocked network; no substitute film requested |
| [Authentication UI](../apps/web/src/components/AuthModal.jsx) | Real registration/login, password verification/change, session revocation, export/deletion; no mock token |
| [API entry point](../apps/api/src/index.ts) and [admin routes](../apps/api/src/routes/admin.ts) | Versioned routes, actual readiness, structured request IDs, validated operations, server-side admin role/CSRF checks, and real sync job results |
| [Playback routes](../apps/api/src/routes/playback.ts) and [token service](../apps/api/src/services/playback.ts) | Signed resource-bound sessions require configured sources; sample/placeholder/DRM/quality/subtitle entitlement fabrication retired |
| [SQL schema](../database/migrations/001_initial_schema.sql), [seed](../database/seeds/001_seed_catalog.sql), [Compose](../docker-compose.yml) | Database design and service configuration exist; current MVP reads a persistent SQLite catalog; legacy endpoints retain old compatibility data |
| [Provider host](../apps/web/src/services/vegaSandbox.js) | Original Vega runtime isolation and module invocation; timeouts and explicit unsupported native operations |
| [CI workflow](../.github/workflows/ci.yml) | Checks, source-build requirement, browser tests, artifacts, and Docker build jobs configured; remote execution unverified |

The scratch playback evidence is local and ignored by version control. Its result is summarized here so this assessment remains useful without that file.

## Coverage of the supplied checklist

| Area | Status | Existing evidence and remaining work |
| --- | --- | --- |
| Product & planning | Partial | Existing blueprint has a problem statement, roles, stories, and proposed requirements. Validate target audience/personas, research, journeys, requirements, edge cases, business rules, acceptance criteria, MVP boundaries, priority, dependencies, feasibility, risks, stakeholder needs, roadmap, milestones, KPIs, cost/capacity estimates, support, and ADRs. Existing performance/availability numbers are targets, not measured guarantees. |
| UI/UX | Partial | Responsive catalog, navigation, search, filters, cards, modals, loading/empty/error states, account/library/admin views. Formal wireframes/prototypes/design system, onboarding, undo, focus behavior, accessibility, tablet coverage, reduced motion, contrast, localization, and print behavior need assessment. Bulk forms, calendars, upload UI, and command palette depend on confirmed workflows. |
| Frontend architecture | Partial | Components, local/server library state, API client, debounced paged search, hash navigation, error boundary, and original Vega worker sandbox. More resilient cache/state policies, storage migration, lazy loading and performance budgets remain. PWA/SSR/experimentation/real-time/WebRTC require use cases. |
| Frontend security | Partial | React escaping, isolated provider runtime, HTTPS/media URL validation, HttpOnly cookie sessions with CSRF checks, and configured production CSP. No browser-stored bearer token. Strict CSP nonce/Trusted Types policy, full dependency/security assessment, permission and privacy review remain. CSP currently permits inline styling and the upstream sandbox bootstrap. |
| Backend architecture | Partial | Hono routes/services, persistent SQLite repositories, schema initialization, validated inputs, body/rate limits, structured errors/logs, readiness, graceful shutdown, transactions, session permissions, and observable sync results. A distributed queue, circuit breakers and connection pooling depend on selected storage/deployment requirements. |
| API engineering | Partial | Versioned REST, OpenAPI contract, bounded paged/filterable catalog, consistent validated errors, request IDs, body/rate limits, cookie sessions, CSRF and ownership checks. Legacy endpoints remain compatible. Bulk APIs/webhooks/SDKs/gateway tooling are conditional. |
| Authentication | Partial, tested | Real server credential hashing/verification, registration/login/logout, cookie sessions, password change, session rotation/revocation/listing, export and deletion. No stored browser bearer token. Email verification/recovery, MFA, OAuth/passkeys/enterprise identity require service decisions. |
| Authorization | Partial, tested | Server-side user/admin permissions, CSRF checks, and owned library/session access; negative tests cover anonymous/admin denial and cross-account isolation. Groups/ABAC/delegation/tenancy remain conditional. |
| Database engineering | Partial, tested | Active single-node SQLite persistence, schema/version record, constraints/indexes, transaction-based seeding/sync, account/library/source storage, and backup/restore rehearsal. PostgreSQL schema remains proposed; managed migration/rollback, replicas, and capacity tuning need deployment decisions. |
| Data management | Partial | Persistent IDs, catalog seed/sync transactions, input validation, owned account library, export/deletion and audit records. Metadata availability stays explicitly demo-labeled. Retention/anonymization, import formats, lineage and external data-quality policies require operational requirements. |
| Search | Partial | Current UI/API share persistent catalog queries, keyword matching, validated bounds, filtering/sorting and paging with a load-more UI. Relevance/typo/facet analytics, large catalog indexes and load tuning remain. Search history/saved searches and OpenSearch require product/scale decisions. |
| File management | Conditional | Browser JSON export exists; no verified upload/storage pipeline. If media/admin uploads are approved, define MIME/content/size validation, quotas, access checks, private/signed downloads, scanning, metadata policy, thumbnails, storage/CDN, resumability, versioning, expiry, and backups. |
| Real-time systems | Conditional | No implemented app collaboration/chat/live dashboard channel found. Add SSE/WebSockets, presence, reconnection, heartbeat, ordering, deduplication, and conflict policy only for confirmed features. |
| Notifications | Conditional | No delivery backend found. Specify in-app/email/push/SMS channels, preferences, localized templates, queues, schedules, retries, delivery status, digest, and unsubscribe behavior before implementation. |
| Payments & billing | Conditional | No billing flow in the agreed movie-discovery scope. A paid product needs verified checkout/webhooks, idempotency, reconciliation, invoices, refunds, subscription/trial handling, tax/currency rules, fraud controls, and audit trails. |
| E-commerce | Conditional | Products/SKUs, carts, inventory, fulfillment, returns, and shipping do not currently match this product. Define a commerce use case before adding them. |
| Multi-tenant architecture | Conditional | No organization/tenant product requirement. Tenant IDs, isolation, invitations, organization permissions, branding, quotas, billing, analytics, export, and deletion need a confirmed business model. |
| Caching | Planned | Redis is in Compose; API integration is absent. Define TTL/invalidation, cache-aside boundaries, failure behavior, warming, and metrics if needed. Separate browser HTTP caching from session/query caching. |
| Messaging & queues | Conditional | No active broker/consumer flow found. Introduce a queue with retry/backoff, idempotency, ordering, deduplication, and dead-letter handling when synchronization/import work requires it. Kafka/RabbitMQ are not MVP assumptions. |
| Background processing | Partial | Real bounded catalog synchronization with a persisted job record, overlap prevention, transactional updates, and failure reporting. It runs within the request; distributed workers/queues/schedulers are not implemented. |
| Security | Partial | Provider module allowlists and isolated sandbox exist; gateway has some headers. Production identity, authorization, validated input, restrictive configurable CORS, rate limits, secret configuration, HTTPS/TLS, CSP, safe URL handling, logging redaction, dependency/SAST/DAST/container scans, and security tests remain. SQL/upload/SSRF controls depend on their actual data paths. |
| Infrastructure | Planned | Dockerfiles, Nginx, and PostgreSQL/Redis Compose configuration exist. Containers have not been built locally. Establish hosting, DNS/TLS, secrets, network boundaries, persistent volumes, storage/CDN, health/readiness, resource limits, monitoring, and infrastructure-as-code appropriate to the selected host. Kubernetes is conditional. |
| Cloud architecture | Conditional | No selected provider or verified deployment. Choose frontend/API/data hosting, region, storage, IAM, budgets, monitoring, and recovery before managed service or multi-zone designs. |
| CI/CD | Partial | Local checks verified; GitHub Actions install/build/check/source-runtime/browser/artifact/Docker jobs configured. Remote run, security/dependency scans, staging, migrations, release tags, approvals, production rollout, rollback, and deployment smoke tests remain. Canary/blue-green needs hosting support and a demonstrated need. |
| Observability | Partial | Structured redacted request logs, correlation IDs, durations/status, actual database readiness, and job/audit records. Central monitoring/metrics/traces/alerts and measured SLOs require a deployment destination. |
| Reliability | Partial | Provider invocation timeouts and visible media failures exist. Verify retry/backoff behavior, graceful degradation, idempotency, shutdown, readiness, recovery, failure tests, incident handling, and postmortems. Redundancy/failover/replication require deployed services. |
| Performance | Partial | Debounced search and minified Vite build verified. Bundle budget, route/component splitting, images, request deduplication, caching/compression, database query plans, pagination, profiling, memory/CPU limits, load/stress tests, and measured playback startup remain. |
| Testing | Verified, limited | 18 API and 26 desktop/mobile Chromium tests pass, plus database restart/backup/restore. Includes account/CSRF/ownership/resource-token tests and fixture media from the actual media server. Actual remote film attempt remains unavailable. Firefox/WebKit, load, deployed failure, full accessibility/security assessment remain. |
| Quality | Partial | Strict lint, API TypeScript checks, and regression suite. Establish formatting, coding/contribution standards, meaningful coverage goals, static/dependency analysis, review ownership, architecture review, and debt tracking. |
| Analytics | Conditional | No production analytics pipeline found. Define privacy-aware discovery/search/playback-success events, consent needs, KPIs, retention/funnels, and performance/error measurements. Do not count fixture playback as real playback success. |
| Administration | Partial, tested | Real stored catalog/source counts, protected source management, observable upstream sync jobs and failures, audit events/API. User/role CRUD, moderation, and larger operational workflows remain extensions. |
| Audit & compliance | Partial | Account/local export, confirmed account deletion, server-side audit events for identity/source/sync operations. Consent/legal-document ownership, retention policy, external audit review and applicable jurisdiction-specific assessment remain. No compliance certification is claimed. |
| Internationalization | Partial | Country selector and generated demo subtitle labels. Country choice does not establish translated UI or actual subtitle/audio tracks. Add locale files, messages, pluralization, dates/numbers/timezones, RTL, and localized communications for chosen locales. Currency support is conditional. |
| Accessibility | Partial, tested | Labeled controls, keyboard-accessible card details, account/detail/player dialogs, focus trap/return, Escape, error/status announcements, reduced-motion and focus styles. Desktop/mobile focus journey tests pass. Full screen-reader/contrast/caption and WCAG assessment remains; real subtitle tracks depend on sources. |
| SEO | Partial | Static app title and HTML shell. Evaluate public discoverable title pages, metadata/OG/canonical URLs, sitemap/robots, structured data, semantic content, image descriptions, performance, and indexing controls. SSR/SSG is a product/hosting decision. |
| Integrations | Partial | Vendored modules built and sandbox catalog executed; live metadata/provider requests attempted. All-provider stream behavior is unverified; browser CORS/native-only requirements can prevent operations. Track configuration, timeouts/retries, health, versions, and failure reasons. Email/storage/payment/CRM/maps integrations are conditional. |
| Documentation | Partial | README/setup, environment contract, active MVP guide, OpenAPI, backup/restore instructions, build report and complete category checklist exist. Older blueprints/API claims are marked proposals/legacy. Hosting-specific deployment, incident/recovery ownership and release documents need selected infrastructure. |
| Git & collaboration | Planned | `.github` configuration exists, but this workspace has no usable Git repository. Repository initialization/remote, branches/PRs/reviews, protection, CODEOWNERS, commits, releases, issues, and milestones have not been verified. No remote publishing performed. |
| Deployment | Planned | Build artifacts and container configurations prepared. Hosting, domain/DNS/HTTPS, secrets, staging/production, migration execution, deployment smoke tests, rollback, scaling, and release approval policies remain. |
| Backups & disaster recovery | Partial, tested | Consistent SQLite backup, integrity/schema verification, non-overwriting restore, and account/library/catalog restoration rehearsal. Remote encrypted storage, automation/retention, recovery owners and RPO/RTO remain deployment work. |
| Maintenance | Planned | Lockfiles and CI provide a foundation. Assign patch/dependency/certificate/domain review, data/log cleanup, backup verification, security/performance/monitoring reviews, API retirement, cost checks, and documentation updates. |
| Advanced/enterprise | Conditional | No justified need established for microservices, service mesh, multi-region, distributed transactions, CQRS, event sourcing, workflow engines, SCIM, data lakes/warehouses, fraud/ML/AI/RAG/vector infrastructure. Select these only after requirements and operational costs are established. |

## Proposed MVP and acceptance gates

The initial product serves individual viewers who browse/search a catalog, choose a region, keep a local library, and open a verified stream or a clearly labeled external availability link. Production accounts and admin mutations require backend identity and permissions. Revenue features and enterprise tenancy are deferred until requested.

| ID | Priority | User outcome and acceptance criteria | Dependencies |
| --- | --- | --- | --- |
| MVP-01 | P0 | Selecting a title plays that title's identified source, or reports that no verified source is available. No unrelated sample film, fabricated quality, subtitle, entitlement, or availability is presented as real. Source provenance is visible to operators. | Catalog IDs, source resolver, permitted test media, reachable network |
| MVP-02 | P0 | Actual-source playback demonstrates decoded frames and increasing media time; pause/resume/seek work; resume persistence matches the selected title/episode. A blocked or unavailable source produces a useful retry/source-choice error. Fixture and live acceptance results are reported separately. | MVP-01, supported codecs, network/media access |
| MVP-03 | P0 | Public discovery remains usable without login. Production sign-in verifies credentials on the server; logout invalidates the session. Admin operations deny anonymous and ordinary users. Users cannot read/change another user's data. | Explicit anonymous/account product choice, identity store, secret/session policy |
| MVP-04 | P0 | API schema rejects malformed/oversized inputs with consistent errors; playback tokens expire and match the requested resource. Production signing secrets are required. Logs exclude credentials/token query values. | API contracts, configuration validation, security tests |
| MVP-05 | P0 | Catalog/library persistence survives service restart; migrations and seed data run against a fresh supported database; rollback or forward repair is documented. No dashboard claims a connected dependency without checking it. | Database driver/repositories, running PostgreSQL |
| MVP-06 | P1 | Search, filters, suggestions, regional metadata, paging, and empty/error states agree between API and UI. Availability comes from an identified source with freshness information. | MVP-05, metadata contract/source |
| MVP-07 | P1 | Keyboard/screen-reader users complete search, details, library, and player journeys. Dialog focus, labels, Escape and focus return are tested. Tablet/mobile overflow and reduced motion are checked. Real subtitle tracks are supported only when present. | Frontend accessibility audit, media metadata |
| MVP-08 | P1 | Original provider operations respect declared module signatures and user enable/order preferences. Failures and native-only limitations are recorded without fake latency/online status. | Provider contracts, resolver integration, upstream dependencies/network |
| MVP-09 | P1 | Catalog sync uses a real job with progress/result/failure status, overlap protection, bounded retries, and audit attribution. | Persistent catalog, chosen job mechanism, admin authorization |
| MVP-10 | P1 | Core/source-runtime CI and container smoke checks pass remotely; staging serves web/API over configured HTTPS; production release has a health check and tested rollback. | Git remote/CI, registry access, Docker host, hosting/secrets |
| MVP-11 | P1 | Real health/readiness and structured request IDs support diagnosis; playback success/errors and API latency are measured; owned alerts exist. Proposed SLOs are set from observed behavior. | Staging deployment, telemetry destination |
| MVP-12 | P1 | Account/local data export/deletion semantics are explicit; backup restoration is demonstrated for persisted data; support/recovery runbooks name owners. | Persistence, data policy, backup destination |

P0 gates block a production-ready claim. P1 work completes the usable and supportable MVP. Estimates and calendar milestones require chosen hosting, identity/media sources, team capacity, and infrastructure access; none are assumed here.

## Dependency-ordered roadmap

1. **Truthful playback and contracts:** selected-title source provenance, real versus demo metadata, resolver/player integration, token/resource checks, and actual-source acceptance. Keep the existing fixture test as a separate decoding regression check.
2. **Identity and persistence:** agree the account model; implement repositories/migrations and backend auth/authorization; synchronize library state and expose real dependency health.
3. **Usable discovery:** consistent paged search/availability, resilient states, accessibility, supported locales, and provider preference enforcement.
4. **Operational MVP:** real sync jobs, logging/metrics, verified source/container CI, staging deployment, backup/restore, rollback, and support runbooks.
5. **Measured growth:** load tests and budget/capacity planning; introduce caches/queues/CDN as warranted. Payments, tenancy, real-time collaboration, enterprise identity, and advanced architecture need separate requirements.

## Principal risks and unresolved decisions

| Risk or decision | Evidence/impact | Resolution needed |
| --- | --- | --- |
| Wrong media mapped to title | Actual Interstellar attempt selected a Tears of Steel sample | Implemented title-bound sources and explicit unavailable states; real network/media acceptance remains |
| Restricted network | npm/GitHub/provider/sample media requests denied locally | Run upstream installs and live playback acceptance in an environment with authorized network access |
| Source-build verification | Local Vega runtime packaged committed upstream bundle | Require and verify fresh source build in remote CI; retain mode/hash provenance |
| Unprotected admin and mock login | Baseline issue resolved with server-side sessions, admin role/CSRF middleware and negative tests | Implemented ordinary/admin account model; verify production HTTPS and identity recovery integration before launch |
| Split demo catalogs | Current discovery uses the SQLite catalog seeded from frontend IDs; legacy endpoints retain compatibility data | Current /catalog contract is canonical for the UI; retire/align legacy endpoints in a versioned migration |
| Provider compatibility | Browser CORS and native WebView/cookie operations differ from upstream native app | Publish a tested capability matrix; report unsupported providers/operations explicitly |
| Unexecuted infrastructure | Docker not installed locally; remote CI not run | Build/run containers remotely and verify actual readiness/routing/migrations |
| Unsubstantiated existing documents | Older blueprints promise connected storage, RBAC, and uptime | Treat them as proposals and use this evidence record for current completion status |
| Hosting, budget, users, and traffic unknown | No validated capacity or cost basis | Establish expected concurrent viewers/API usage, region, data sizes, service owners, and monthly budget |

## Completion record

- [x] Preserve the existing scoped platform build/test pipeline.
- [x] Record the successful clean check and its coverage limits.
- [x] Record the failed actual playback attempt separately from fixture tests.
- [x] Map every supplied top-level checklist area to current evidence and gaps.
- [x] Define dependency-ordered MVP acceptance gates and release blockers.
- [x] Implement and locally verify the MVP account/session/admin/source/catalog/library core.
- [x] Verify local database restart, consistent backup, integrity, and restore.
- [ ] Complete actual remote-film, deployed HTTPS, source/container CI, and operational release gates.
- [ ] Verify remote source builds, container execution, deployment, and restore procedures.
- [ ] Obtain product-specific decisions for conditional features before expanding the platform.
