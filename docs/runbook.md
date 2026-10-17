# Movie Platform Runbook

## Severity levels
- **SEV1**: playback or auth down for all users. Page on-call immediately.
- **SEV2**: degraded latency/errors, single provider down. Respond within 30 min.
- **SEV3**: preview/staging issue. Next business day.

## High error rate
1. Check `/metrics` and `/api/v1/metrics` for the failing route.
2. Check Grafana golden-signals dashboard (error rate panel).
3. If deploy-correlated: `kubectl rollout undo deployment/movie-platform-api`.
4. If dependency: check `/ready` (DB) and upstream provider status.

## Tail latency
1. Identify slow route in `latency_ms` percentiles.
2. Check saturation (`in_flight`, `saturation_peak`).
3. Scale: `kubectl scale deployment movie-platform-api --replicas=6` or wait for HPA.
4. If DB-bound: inspect slow-query log; add index or cache.

## Saturation
1. Confirm HPA events: `kubectl describe hpa movie-platform-api`.
2. Shed preview traffic first; protect production.
3. Raise `maxReplicas` only after confirming CPU/memory headroom.

## Rollback
- One-click: `kubectl rollout undo deployment/movie-platform-api`
- Canary abort: `kubectl argo rollouts abort movie-platform-api`
- Container images are immutable per release tag; SBOM attached to the release.

## On-call
- Alerts route via Alertmanager → PagerDuty/Opsgenie → Slack webhook.
- Every alert links here. Update this file after each postmortem.
