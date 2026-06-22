# ADR-0001: Modular monolith over microservices

- Status: Accepted
- Date: 2026-06
- Deciders: Backend architecture

## Context

Sweet Treats is a two-sided transactional marketplace. The transactional core —
orders, inventory, payments, discounts, delivery slots — must be mutually
consistent and is currently handled by single-database ACID transactions with
pessimistic locks (checkout). The team is small and traffic is low and seasonal.

## Decision

Build and keep a **modular monolith** in NestJS: one deployable HTTP API with
strict, lint-enforced module boundaries, plus a **separate worker deployment**
(same codebase, different entrypoint) for async work. Modules communicate via
in-process service interfaces and in-process domain events — never internal HTTP.

Defer microservices. Extract a service only when there is a *measured* bottleneck
or org-scaling reason. Planned extraction order if/when needed: **search →
media/image processing → notifications**. Orders + payments + inventory remain in
the monolith essentially forever because they share a transaction boundary.

## Alternatives considered

- **Microservices now** — rejected. Would convert one DB transaction (checkout)
  into a distributed saga, add network failure modes, and multiply ops cost for
  no benefit at current scale.
- **Serverless functions** — rejected for the core API (cold starts, connection
  exhaustion against Postgres, harder transactions); fine later for isolated
  webhook/cron handlers.

## Consequences

- (+) One transaction boundary for money/inventory; simplest correctness story.
- (+) One deploy, one codebase, low ops cost; fast feature velocity.
- (+) Clear, cheap path to extract services later because boundaries are explicit.
- (−) Must enforce boundaries with discipline (lint rules, code review) or the
  monolith rots into a big ball of mud.
- (−) One scaling unit for the API (mitigated: it's stateless and scales by
  replica count; workers scale independently).
