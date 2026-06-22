# ADR-0006: Observability — structured logs, health, metrics, tracing

- Status: Accepted (logging + health now; metrics/tracing/Sentry next)
- Date: 2026-06

## Context

The app uses the default Nest logger and stray `console.*`; there is no request
correlation, no readiness probe for the load balancer, no metrics, tracing or
error tracking. You cannot operate a payment platform you cannot see.

## Decision

Adopt the three pillars plus business telemetry, introduced in low-risk order:

- **Logging (now):** **Pino** structured JSON via `nestjs-pino`. A request-id
  middleware assigns/propagates `x-request-id`; every request logs one line with
  `requestId`, `userId?`, `route`, `status`, `durationMs`. Redact PII/secrets/
  tokens. Ship to Loki/CloudWatch/Datadog.
- **Health (now):** `@nestjs/terminus` — `/health/live` (process up) and
  `/health/ready` (DB reachable; Redis/queue added when introduced). LB gates
  traffic on readiness.
- **Errors (next):** **Sentry** with releases + source maps; alert on new/spike.
- **Metrics (next):** Prometheus (`/metrics`) — RED per route + business KPIs
  (orders/min, checkout success %, payment failure %, GMV, p95 checkout).
- **Tracing (next):** OpenTelemetry spans API→DB→Stripe→queue→worker; sample tail
  latency.
- **Alerting:** SLO-based, page on *symptoms* (checkout success < 99%, p95 breach,
  error spike, replica lag, queue backlog, DLQ > 0), not causes.

## Alternatives considered

- **Keep default logger / console** — rejected; unparseable, no correlation, no
  redaction.
- **All-in-one APM only (Datadog) from day one** — viable but cost-heavy; start
  with open structured logs + Sentry, add APM as scale/budget warrants. Keep the
  instrumentation vendor-neutral (OTel) to avoid lock-in.

## Consequences

- (+) Correlated, queryable logs and a real readiness probe immediately — safe,
  additive, no behavior change.
- (+) Foundation that every later concern (alerting, tracing, audit) builds on.
- (−) Slight per-request logging overhead (negligible with Pino).
- (−) Full metrics/tracing/alerting is incremental work tracked in the backlog.
