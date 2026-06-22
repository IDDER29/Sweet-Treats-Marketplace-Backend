# ADR-0005: API standards — REST, RFC 9457 errors, cursor pagination

- Status: Accepted (OpenAPI now; envelope/error migration is breaking → phased)
- Date: 2026-06

## Context

The API is REST/JSON on NestJS with a global `ValidationPipe`. Response shapes and
error formats are currently inconsistent across modules, pagination is mixed, and
there is no published contract. A frontend consumes these endpoints, so changing
response shapes is a breaking, coordinated change.

## Decision

- **REST + OpenAPI-first.** GraphQL deferred (revisit only if mobile over-fetching
  is a measured problem). Generate the spec from `@nestjs/swagger` decorators and
  publish at `/api/docs`.
- **Versioning:** URI prefix `/api/v1`; bump only on breaking changes; additive
  fields are non-breaking (clients tolerate unknown fields).
- **Envelope:** success `{ data, meta }`; collections include
  `meta.page = { cursor, hasMore, limit }`.
- **Errors:** **RFC 9457 Problem Details** with a stable machine-readable `code`
  and `requestId`. One global exception filter.
- **Pagination:** **cursor-based** for user-facing lists (stable under inserts);
  offset only for admin tables needing totals; `limit` always bounded (≤ 100).
- **Filter/sort/search:** explicit allow-lists only; never interpolate
  client-supplied column names.
- **Idempotency:** require `Idempotency-Key` on `POST /orders` and payment-intent
  creation; store key→response in Redis (24h) and replay on retry. Stripe webhooks
  dedupe on event id.
- **Rate limiting:** tiered, **Redis-backed** (so limits hold across replicas),
  stricter on auth/checkout; `429` + `Retry-After`.
- **AuthZ:** Bearer JWT + role guard + per-resource ownership policy (ADR-0002).

## Alternatives considered

- **GraphQL / hybrid** — deferred; adds N+1 risk, caching complexity, a second
  security surface; REST + OpenAPI is the better fit for a cacheable,
  mobile/partner-facing marketplace.
- **Offset pagination everywhere** — rejected for user lists; unstable under
  inserts and O(n) deep pages. Kept only where exact totals matter (admin).
- **Ad-hoc error strings** — rejected; clients must branch on a stable `code`, not
  on human-readable `detail`.

## Consequences

- (+) Predictable, documented, typed contract; generated frontend clients.
- (+) Consistent errors and pagination simplify every client.
- (−) The envelope + RFC-9457 migration changes every response shape — **breaking**.
  Roll out coordinated with the frontend (e.g. behind `/api/v1`, or an
  `Accept`-negotiated transition), not as a silent change. Update e2e assertions
  in lockstep.
- (−) Idempotency + Redis rate limiting depend on Redis (ADR-0003 infra).

## Rollout

1. **Now:** OpenAPI/Swagger published; document conventions.
2. **Coordinated:** introduce the `{ data, meta }` envelope + RFC-9457 filter +
   cursor pagination under `/api/v1` with the frontend.
3. **With Redis:** Idempotency-Key middleware + distributed rate limiting.
