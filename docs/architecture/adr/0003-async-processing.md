# ADR-0003: Async processing with BullMQ + Redis

- Status: Accepted (deferred until Redis is provisioned)
- Date: 2026-06

## Context

Several side-effects currently run inline or as unmanaged fire-and-forget on the
request path: order-confirmation/seller-alert emails, (future) image derivatives,
Stripe webhook processing, analytics. Inline slow work hurts tail latency and
couples the user's request to fragile externals (SMTP, image libs, provider APIs).

## Decision

Adopt **BullMQ on Redis**, with workers in a **separate deployment** (same repo,
different entrypoint) so a job spike cannot starve API request handling.

Queues by concern + priority:

| Queue | Purpose | Priority |
|---|---|---|
| `email` | confirmations, alerts, password reset | high |
| `media` | image resize/derivatives, AV scan | normal |
| `webhooks:stripe` | process verified events idempotently | high |
| `payouts` | Stripe Connect seller payout batches | critical, low-throughput |
| `search-index` | product upserts → search engine | low |
| `analytics-rollup` | hourly/daily aggregates | scheduled |
| `expirations` | discount/quote/slot expiry, stale PENDING cleanup | scheduled |

Rules:
- **Idempotent handlers** keyed by order id / Stripe event id (tolerate
  at-least-once delivery / replays).
- **Retries**: exponential backoff + jitter, capped attempts → per-queue **DLQ**;
  alert on DLQ depth > 0.
- **Schedulers** via BullMQ repeatable jobs guarded by a Redis lock / single
  leader to avoid multi-replica double execution.
- Domain events (`OrderPaid`, `RefundIssued`, `ReviewCreated`) → handlers enqueue
  jobs. This is event-driven *within* the monolith: decoupling without the
  distributed-systems tax.

## Alternatives considered

- **Keep fire-and-forget** — rejected; no retries, no visibility, lost emails.
- **SQS** — viable if we go serverless; chosen against now to reuse Redis and get
  better NestJS DX. Revisit if the API moves to Lambda/Cloud Run jobs.
- **Kafka** — rejected; we need a work queue, not a high-throughput ordered log /
  event-sourcing backbone.

## Consequences

- (+) Request path returns fast; side-effects retried and observable; DLQ for
  poison messages.
- (+) Workers scale on queue depth, independent of API.
- (−) New stateful dependency (Redis) and operational surface (queue dashboards,
  DLQ runbooks).
- (−) The app gains a hard dependency on Redis for full functionality — until
  provisioned and reliable, async features stay documented, not shipped. The
  current in-memory throttler and inline (caught) email keep the app runnable
  without Redis in the interim.
