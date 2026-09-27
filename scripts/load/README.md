# API load testing preparation (S6-T08)

Load tests are **not** executed in CI. Use this guide before capacity planning.

## Tools

- [k6](https://k6.io/) — scripted HTTP load (`scripts/load/api-smoke.js`)
- Optional: Artillery, Locust, or cloud provider load tools

## Prerequisites

1. Staging API with representative Neon database size.
2. Seeded users / devices / sync records (≥10k sync rows for sync paths).
3. Auth tokens obtained via login (do not brute-force register in load tests).
4. `CORS` / WAF allowlists configured for the test runner IP.

## Smoke run

```bash
cd backend
k6 run -e BASE_URL=https://api.staging.stridely.app scripts/load/api-smoke.js
```

## Suggested scenarios (future)

| Scenario | Path | Notes |
|----------|------|-------|
| Health | `GET /health/live` | Baseline RPS |
| Auth login | `POST /api/v1/auth/login` | Low VU; respect throttle |
| Sync upload | `POST /api/v1/sync/upload` | Batch 50–100 ops |
| Sync download | `POST /api/v1/sync/download` | Cursor pagination |
| Notifications | `POST /api/v1/notifications` | Prefer mock provider |

## Guardrails

- Never run destructive load against production without approval.
- Cap refresh-token rotation tests (family revoke on reuse).
- Watch Neon connection limits and Prisma pool size.
- Capture p50/p95/p99 latency and error rate dashboards.

## Success criteria (template)

- Error rate < 1%
- p95 latency < 800ms for health; < 2s for sync batch
- No sustained DB CPU > 70% during test window
