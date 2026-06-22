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
- ⬜ Sentry error tracking (needs DSN/secret) — wire `@sentry/node`, releases.
- ⬜ Prometheus `/metrics` (RED + business KPIs) + Grafana dashboards.
- ⬜ OpenTelemetry tracing (API→DB→Stripe→queue).

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

## Phase 5 — Redis platform  🔒 (needs provisioned Redis)
- 🔒 Provision managed Redis (env: `REDIS_URL`); graceful-degrade if absent in dev.
- 🔒 Distributed rate limiting (replace in-memory throttler storage).
- 🔒 Cache-aside for hot reads (product detail, category tree, seller dashboard
  aggregates) with event-based invalidation.
- 🔒 Idempotency-Key middleware for checkout / payment intents.

## Phase 6 — Async / BullMQ  🔒 (needs Redis; ADR-0003)
- 🔒 BullMQ + separate worker deployment.
- 🔒 Migrate email + Stripe-webhook processing + image derivatives to queues with
  retries + DLQ + alerting.
- 🔒 Schedulers (discount/quote/slot expiry, stale-PENDING cleanup, rollups) with
  leader lock.

## Phase 7 — Auth unification  🔒 (needs Redis + frontend coord; ADR-0002)
- 🔒 Standardize bcrypt cost to 12 across user + business.
- 🔒 RS256 access tokens (key in secrets manager, `kid` rotation).
- 🔒 Rotating opaque refresh tokens in Redis + reuse-detection + `/auth/refresh`.
- 🔒 Fold business auth into the unified identity/token model.
- 🔒 MFA (TOTP) for admins.

## Phase 8 — Scale & performance  🔒
- 🔒 PgBouncer (transaction pooling) before scaling API replicas.
- 🔒 Read replica + read/write routing for catalog/analytics/admin.
- 🔒 CDN + Cloudflare R2 (presigned uploads, on-the-fly resize).
- 🔒 Postgres FTS (`tsvector` + `pg_trgm`) → Meilisearch at scale.

## Phase 9 — Platform & DevOps  🔒
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
