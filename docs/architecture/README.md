# Sweet Treats — Backend Architecture

Engineering blueprint for the Sweet Treats multi-vendor marketplace backend.
This is the canonical reference for how the system is built and where it is
going. Deep, reversible decisions live in [ADRs](./adr); the sequenced work
plan lives in [IMPLEMENTATION_BACKLOG.md](./IMPLEMENTATION_BACKLOG.md).

> **Domain in one line:** a two-sided, transactional commerce platform — many
> independent bakeries sell to many customers, with real money, inventory,
> delivery slots and bespoke-order workflows. **Correctness and money-safety
> dominate over raw scale.**

---

## 1. Vision & goals

The backend must run a marketplace (discover → order → pay → fulfil), move money
correctly (server-authoritative pricing, atomic checkout, Stripe, refunds,
seller payouts), and stay safe by default (tenant isolation, PII protection,
auditable privileged actions).

**Scale to plan for** (not 100×): MVP 1k–10k MAU, dozens of sellers, <10
orders/min; growth 100k–500k MAU, thousands of sellers. Traffic is **read-heavy
(~20:1)** and **highly seasonal** — expect 10–30× spikes on specific days
(Valentine's, Christmas).

**Targets**

| Surface | p95 latency | Notes |
|---|---|---|
| Catalog read (cached) | < 150 ms | dominant traffic |
| Checkout (write txn) | < 700 ms | the revenue path |
| Auth | < 250 ms | |
| Webhook ack | < 200 ms | then async |

Reliability: 99.5% MVP → 99.9% API / **99.95% checkout** at growth. RPO ≤ 5 min
(PITR), RTO ≤ 1 h MVP. Security: OWASP API Top 10 baseline, PCI **SAQ-A**
(card data never touches us — Stripe-hosted), GDPR/UK-GDPR for PII, full audit
trail on privileged/financial actions.

**Core principles**
1. Server is the source of truth for money and inventory.
2. Strong consistency for money/inventory; eventual consistency for derived data
   (ratings, dashboards, search).
3. **Modular monolith first** — extract a service only for a measured reason.
4. Everything important is idempotent (checkout, webhooks, jobs).
5. Boring, proven tech (Postgres + Redis + a queue).

---

## 2. Architecture style — modular monolith + async workers

See **[ADR-0001](./adr/0001-architecture-style.md)**. One NestJS deployable with
strong module boundaries, plus a separate worker deployment for async work.
Microservices are explicitly deferred: one team, a shared transactional core
(orders↔inventory↔payments↔discounts), low traffic. The current codebase is
already a modular monolith — we harden the boundaries rather than fragment it.

```
CDN/WAF → LB → API (NestJS, N stateless replicas)
                 │            │              │
            PostgreSQL     Redis         Queue (BullMQ)
          (primary+replica) (cache/      → Worker pool (email, media,
                             sessions/      webhooks, payouts, rollups)
                             rate-limit)
            Object storage (S3/R2) · Stripe · Email (SES/Postmark) · Search (later)
```

**Bounded modules:** identity · catalog · orders · payments · fulfilment
(delivery slots + custom orders) · engagement (reviews/discounts) · back-office
(admin/analytics/audit) · notifications.

**Communication:** in-process service calls across module boundaries (no internal
HTTP); in-process **domain events** (`@nestjs/event-emitter`) for side-effects →
which enqueue jobs; **queue** for everything slow/external. Boundaries enforced
by lint rules, not the network.

**Sync vs async:** sync for auth, catalog reads, checkout, payment-intent
creation. Async for all email, image processing, webhook *processing*, analytics
rollups, payouts, search indexing, scheduled expirations.

**Extraction order if/when needed:** search → media/image processing →
notifications. Orders+payments+inventory stay in the monolith (shared txn).

---

## 3. Technology stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | NestJS (TS), **Fastify adapter** | already in use; Fastify ~2× read throughput |
| API | REST, **OpenAPI-first**; GraphQL deferred | see [ADR-0005](./adr/0005-api-standards.md) |
| Primary DB | PostgreSQL 16 (managed) | relational integrity for money/inventory + JSONB |
| ORM | TypeORM; raw SQL for hot/locking queries | migrations only in prod (`synchronize:false`) |
| Cache/sessions/RL | **Redis** | cache, refresh-token store, distributed rate-limit, BullMQ |
| Queue | **BullMQ** (Redis) | retries, backoff, DLQ, cron; see [ADR-0003](./adr/0003-async-processing.md) |
| Search | Postgres FTS/`pg_trgm` → Meilisearch | async-indexed from product events |
| File storage | **Cloudflare R2** (or S3) | presigned uploads, CDN, no egress on R2 |
| Realtime | deferred → Socket.IO+Redis / Ably | not a chat app |
| Logging | **Pino** (structured JSON) | `requestId` correlation |
| Metrics/Tracing | Prometheus+Grafana / Datadog · OpenTelemetry | RED + business KPIs |
| Errors | **Sentry** | from day one |
| Email | Postmark → SES | worker-sent |
| Infra | Docker + PaaS (Render/Fly) → Fargate/Cloud Run | **skip Kubernetes early** |

---

## 4. Data & multi-tenancy

Relational core (User, Business, Product, Category, Order, OrderItem, Payment,
DeliverySlot, DiscountCode, DiscountCodeUsage, Review, CustomOrderRequest,
**AuditLog**). UUID PKs, money as `NUMERIC(12,2)` (+ CHECK ≥ 0), native enums
with explicit FSMs, `created/updated/deleted_at` everywhere (soft-delete).

**Multi-tenancy:** shared schema, **row-level tenancy by `business_id`** — correct
for a marketplace where cross-tenant reads (global search, admin) are
first-class. The critical control is that **every seller-scoped query filters by
the authenticated `business_id`**, enforced by a policy layer (not ad-hoc
`where`). See **[ADR-0004](./adr/0004-multi-tenancy.md)**.

**Scaling path (in order, only as needed):** cache hot reads → read replica
(route catalog/analytics reads) → PgBouncer (transaction pooling) → vertical →
functional split. **Sharding is avoided**; if ever forced, shard by `business_id`.

**Migrations:** TypeORM, reversible, verified against a clean DB, expand/contract
for breaking changes. **Backups:** PITR + snapshots, **tested restores quarterly**.

---

## 5. API standards (summary)

REST + OpenAPI, `/api/v1`, plural nouns, `camelCase` JSON. Standard envelope
`{ data, meta }`; errors as **RFC 9457 Problem Details** with stable machine
`code`s. **Cursor pagination** for user lists (bounded `limit` ≤ 100).
Allow-listed filter/sort (never interpolate client column names).
**Idempotency-Key** on checkout + payment-intent. Tiered **Redis** rate limiting.
Bearer JWT + per-route role guard + **per-resource ownership policy**. Full
detail in **[ADR-0005](./adr/0005-api-standards.md)**.

---

## 6. Auth & authz

**Unify the two parallel auth systems** (today: `user` JWT + `business`
business-jwt) into one identity + token model: short-lived **RS256** access JWT
+ **rotating opaque refresh token** in Redis (reuse-detection), bcrypt cost 12
everywhere, MFA for admins, **two-layer authorization** = role guard + resource
**policy/ownership guard** (the structural fix for IDOR). Full plan and risks in
**[ADR-0002](./adr/0002-authentication-authorization.md)**.

---

## 7–16. Cross-cutting strategy

- **Scalability/perf:** stateless API behind LB; multi-layer cache (CDN → Redis →
  in-proc); push slow work to the queue; pre-scale named seasonal dates.
- **Async:** BullMQ queues (`email`, `media`, `webhooks:stripe`, `payouts`,
  `search-index`, `analytics-rollup`, `expirations`), exponential backoff + DLQ,
  idempotent handlers, leader-locked schedulers. [ADR-0003](./adr/0003-async-processing.md).
- **Security:** policy-based BOLA/IDOR prevention, parameterized SQL, secrets
  manager + RS256 (no fallback secrets in prod), audit logs, WAF/rate-limit,
  Stripe-hosted card data, GDPR erasure-by-anonymization. Critical surfaces:
  checkout/webhooks, auth, seller-scoped access, uploads, admin.
- **Observability:** structured logs + `requestId`, RED + business metrics, OTel
  tracing, Sentry, `/health/live` + `/health/ready`, SLO-based alerting.
  [ADR-0006](./adr/0006-observability.md).
- **Infra/DevOps:** Docker, PaaS→Fargate/Cloud Run, Terraform IaC, blue-green +
  auto-rollback, migrations pre-deploy with snapshot, multi-AZ, tested DR.
- **Reliability:** retries (idempotent only) + backoff, circuit breakers around
  Stripe/email, timeouts everywhere, graceful degradation (checkout depends only
  on Postgres+Stripe), ACID for money + eventual for derived data.
- **Cost:** R2 (no egress) for images, kill N+1/`COUNT(*)`, cap autoscaling,
  Postgres RAM over vCPU, abstract vendors (PaymentProvider/Storage/Mailer).

---

## 17. Critical priorities & risks

**Top priorities (ordered):** (1) unify auth + **policy authz** + **audit log**;
(2) Redis (rate-limit/sessions/cache); (3) BullMQ workers + DLQ; (4)
observability; (5) API envelope/RFC-9457/OpenAPI/cursor pagination; (6) read
replica + CDN/R2 + caching + FTS; (7) Stripe Connect payouts; (8) Nest 11/Express
5 upgrade.

**Biggest risks:** dual auth + scattered ownership checks (IDOR/escalation);
in-memory rate limiting (breaks on replica #2); slow work in the request path;
premature microservices/Kubernetes; untested backups/irreversible migrations;
under-planned seasonal spikes.

**Decide before building further:** seller **payout/settlement** model (Stripe
Connect), tax/VAT, refund/dispute/chargeback flows, delivery-provider model,
**price/inventory snapshotting at order time**, i18n/currency scope, data
residency/GDPR posture.

---

## Implementation status

This blueprint is being applied incrementally. Live status and acceptance
criteria are tracked in **[IMPLEMENTATION_BACKLOG.md](./IMPLEMENTATION_BACKLOG.md)**.
