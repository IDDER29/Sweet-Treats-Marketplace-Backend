# Implementation Backlog

Sequenced rollout of the [architecture blueprint](./README.md). Ordered by
priority and dependency. Each item has acceptance criteria. Status legend:
✅ done · 🟡 in progress · ⬜ todo · 🔒 blocked (needs infra/review).

Guiding rule for automated/unreviewed work: ship items that are **additive,
verifiable, and need no new infrastructure or breaking API changes**. Items that
need Redis, RS256 key management, or break the response contract are specified
here and left for a reviewed rollout.

---

## Phase 0 — Foundations already in place ✅
(From prior remediation — context for what's built.)
- ✅ App boots; production migration path; 4 reversible migrations.
- ✅ Security/commerce-correctness bug fixes (IDOR patches, refund/cancel resource
  restoration, verified-purchase reviews, per-customer discount limits,
  single-use reset tokens, webhook idempotency).
- ✅ Schema hardening (FK indexes, soft-delete, decimal rating, CHECK constraints).
- ✅ Dead duplicate entity set removed.
- ✅ Real test suite (44 tests: 23 unit + 21 e2e) + CI-able.
- ✅ Dependency criticals 0, highs 21→6.

---

## Phase 1 — Observability foundations  (additive, no infra)
- ✅ Request-id correlation middleware (`x-request-id` in/out, on every log line).
- ✅ Health checks — `/health/live`, `/health/ready` (DB) via `@nestjs/terminus`.
- ✅ Structured logging — Pino (`nestjs-pino`) as the app logger; per-request log
  line with `requestId`, method, route, status, duration; PII/secret redaction.
- ✅ Sentry error capture wired (DSN-gated no-op without `SENTRY_DSN`); a global
  interceptor reports 5xx and re-throws so error responses are unchanged.
- ✅ Prometheus `/metrics` — default Node/process metrics, RED
  `http_request_duration_seconds` (route-pattern labels), and business counters
  (`orders_created_total`, `order_value_gbp_total`). ⬜ Grafana dashboards + alerts.
- ⬜ OpenTelemetry tracing (API→DB→Stripe→queue) — wants an OTLP collector to be
  meaningful; deferred to the infra phase.

**Acceptance:** every response carries `x-request-id`; `/health/ready` returns 503
when DB is down; logs are structured JSON; build + e2e green.

## Phase 2 — Audit logging  (additive, one migration)
- ✅ `AuditLog` entity + migration (actor, action, resourceType, resourceId,
  metadata, ip, createdAt).
- ✅ `AuditService` + `@Audit()`/interceptor wired into admin actions
  (suspend / unsuspend / verify-hygiene).
- ⬜ Extend to seller financial actions (refunds, payouts, price changes) and
  auth events (login, password change, role change).
- ⬜ Tamper-evident hash-chain for the highest-sensitivity events.

**Acceptance:** every admin moderation action writes an immutable audit row;
covered by a test.

## Phase 3 — Structural authorization (anti-IDOR)  (additive, code only)
- ✅ Reusable resource-ownership policy primitive (`OwnershipService` /
  `@CheckPolicy`) — loads the resource and asserts principal ownership.
- ✅ Refactor existing ownership checks (product, order, review, discount) to use
  it, preserving behavior; regression tests assert cross-tenant access → 403.
- ⬜ Apply to every remaining seller/customer-scoped route; add a CI lint/test
  ensuring resource routes declare an ownership policy.
- ⬜ Postgres Row-Level Security as defense-in-depth.

**Acceptance:** ownership enforced through one mechanism; cross-tenant access
tests pass; no service does ad-hoc ownership `where` checks.

## Phase 4 — API contract: OpenAPI  (additive)
- ✅ `@nestjs/swagger` published at `/api/docs`; spec served at `/api/docs-json`.
- ⬜ Decorate DTOs/controllers with response/param schemas; generate typed client.
- 🔒 `{ data, meta }` envelope + RFC-9457 errors + cursor pagination — **breaking**,
  roll out with the frontend under `/api/v1` (ADR-0005).

**Acceptance:** `/api/docs` renders all endpoints; spec is the published contract.

---

## Phase 5 — Redis platform  (provisioned)
- ✅ Shared ioredis client (`RedisModule`, `REDIS_URL`) with graceful no-op
  degradation when absent + clean shutdown (no leaked connection).
- ✅ Distributed rate limiting — throttler counters in Redis (shared client) so
  limits hold across replicas; in-memory fallback without Redis.
- ✅ Cache-aside `CacheService` (null/error-safe) applied to the category tree
  with invalidation on create; unit + runtime verified.
- ⬜ Extend caching to product detail / seller dashboard aggregates.
- ⬜ Idempotency-Key middleware for checkout / payment intents.

## Phase 6 — Async / BullMQ  (in progress)
- ✅ BullMQ root (`QueueModule`) on Redis with reliability defaults (5 attempts,
  exponential backoff, bounded dead-letter set).
- ✅ Order emails moved to the `email` queue (producer + in-process processor),
  with inline fallback when Redis is absent; verified jobs enqueue, retry and
  the worker shuts down cleanly.
- ⬜ Dedicated worker deployment entrypoint (processor runs in-process for now).
- ⬜ Move Stripe-webhook processing + image derivatives onto queues; DLQ alerting.
- ⬜ Schedulers (discount/quote/slot expiry, stale-PENDING cleanup, rollups) with
  a Redis leader lock.

## Phase 7 — Auth hardening  (core done; ADR-0002)
- ✅ bcrypt cost standardized to 12 (user + business).
- ✅ Short-lived access token (15m) + single-use **rotating refresh tokens** in
  Redis (`/users/auth/refresh`, `/users/auth/logout`); revocable; graceful
  without Redis. e2e verifies rotation + single-use rejection.
- 🔁 RS256 — deferred by design: HS256 + short TTL + refresh is correct for the
  monolith; adopt RS256 at the gateway/service-split (ADR-0002 note).
- ✅ Reuse-detection: refresh tokens carry a *family*; rotation marks the old
  token `used` (kept, not deleted), and replaying a used token burns the whole
  family (atomic `active→used` flip via Lua). Verified against live Redis (unit)
  and through HTTP (e2e: the valid rotated token dies once the family is burned).
- ✅ Business auth at parity with users: short-lived access token (15m) +
  rotating refresh token (`/business/auth/refresh`, `/business/auth/logout`).
  Refresh tokens are principal-`kind` namespaced ('user' vs 'business') and the
  kind is enforced *inside* the atomic rotate (a token sent to the wrong
  endpoint is rejected **without** being consumed). e2e covers business rotation
  + cross-kind rejection.
- ⬜ MFA (TOTP) for admins.

## Phase 8 — Scale & performance  🔒
- 🔒 PgBouncer (transaction pooling) before scaling API replicas.
- 🔒 Read replica + read/write routing for catalog/analytics/admin.
- ✅ Presigned direct-to-S3 uploads: `POST /uploads/product-image/presign`
  returns a short-lived (5m) signed PUT URL so image bytes never transit the
  API; the object key is minted server-side under the business prefix.
  `STORAGE_ENDPOINT` makes it work against any S3-compatible store (MinIO/R2);
  docker-compose wires MinIO + a bucket-init container. Verified with a real
  PUT→GET round-trip against MinIO (200, content-type preserved, bytes match)
  and a unit spec over the signed URL. → CDN + on-the-fly resize remain infra.
- ✅ Postgres full-text product search: weighted `tsvector`
  (name▸description▸ingredients), `plainto_tsquery`, relevance-ranked
  (`ts_rank`), backed by a GIN expression index (`AddProductFullTextSearch`
  migration). Stemmed + stop-word aware — "cakes" matches "cake" (ILIKE missed
  it). Works in dev (synchronize, seq-scan) and prod (migration, index-scan —
  verified via EXPLAIN). e2e covers the stemmed match. → Meilisearch at scale.

## Phase 9 — Platform & DevOps  (containerization done; cloud infra 🔒)
- ✅ Multi-stage `Dockerfile` (`node:20-slim`): builder compiles TS → `dist`,
  prunes to prod deps; runtime is non-root (`appuser`), `dumb-init` PID 1,
  container `HEALTHCHECK` on `/health/ready`. Verified end-to-end: image builds,
  boots in `NODE_ENV=production`, runs the full 5-migration chain against a fresh
  DB, serves `/health/*` + `/metrics`; the worker entrypoint (`node dist/worker`)
  boots and processes queues. Optional `--secret id=npm_ca` supports building
  behind a TLS-inspecting egress proxy without baking certs into the image.
- ✅ `docker-compose.yml` dev stack with prod parity: postgres, redis, mailhog
  (SMTP), minio (S3), API (`PROCESS_QUEUES=false`) + dedicated worker
  (`PROCESS_QUEUES=true`) from the same image.
- ✅ GitHub Actions CI (`.github/workflows/ci.yml`): postgres+redis services,
  `lint → build → test → test:e2e`, plus a gated image-build job (buildx, GHA
  cache).
- 🔒 Terraform IaC; Fargate/Cloud Run; blue-green + auto-rollback; pre-deploy
  migration with snapshot; multi-AZ; tested DR/restore.
- 🔒 Sentry/metrics/tracing wired to alerting (SLO-based).

## Phase 10 — Commerce depth  🔒
- 🔒 Stripe Connect seller payouts + reconciliation; refund/dispute/chargeback
  flows; tax/VAT; price/inventory snapshot-at-order-time guarantees.

## Phase 11 — Framework upgrade  🔒 (own branch, reviewed)
- 🔒 NestJS 10→11 / Express 5 (rewrite the `@Delete(':key(*)')` wildcard route,
  regression-test uploads + throttling) — clears the remaining 6 high advisories.

---

## Decisions to settle before deeper build (product-shaping)
- Seller **payout/settlement** model (Stripe Connect express vs standard, fees,
  holds, refunds-after-payout).
- Tax/VAT handling; refund/dispute/chargeback workflows.
- Delivery-provider model (own fleet vs third-party integration).
- **Price/inventory snapshotting** at order time (must be immutable).
- i18n/currency scope; data residency / GDPR posture.
