# Production Hardening — ready for hundreds of customers + businesses

Goal: no cross-tenant leaks, no abuse vectors, no scale cliffs, no insecure
defaults. Authorization audit already passed (every sensitive route guarded;
only health/metrics/shops/root are intentionally public). Remaining hardening,
each shipped with tests + a prod-chain migration check where schema changes.

## PH-1 — Fail-fast config validation  (no insecure prod deploys)
- On boot in `NODE_ENV=production`, refuse to start if `JWT_SECRET` is unset or
  equals the dev fallback, or if any `DB_*` is missing. (Today it only warns and
  silently uses `'mySecretKey'`.) Unit-test the validator.

## PH-2 — Rate-limit hardening  (brute-force + spam)
- `@Throttle` overrides: business login (5/min·20/hr), driver login (5/min) +
  register (10/hr), messaging send + review create (anti-spam). Global tiers
  already cover the rest.

## PH-3 — Scale: indexes + pool + timeouts
- Migration: index `order(driver_id)`, `conversation(customer_id)`,
  `conversation(business_id)` — all back list queries added in P3–P9.
- TypeORM `extra`: `max` pool size (`DB_POOL_SIZE`, default 10) and
  `statement_timeout` (`DB_STATEMENT_TIMEOUT_MS`, default 10s) so a runaway query
  can't pin a connection. Unit-tested in `buildTypeOrmOptions`.

## PH-4 — Pagination on unbounded lists
- Paginate conversations (customer + seller) and cap page sizes (others already
  capped). Prevents a heavy account from loading everything.

## PH-5 — Redis-aware readiness (+ two availability bugs it surfaced)
- `/health/ready` reports Redis status (`up` | `degraded` | `disabled`) via a
  custom indicator that NEVER fails readiness — Redis is optional, so a Redis
  blip must not drain the load balancer. The DB stays the hard gate.
- **Bug found & fixed — Redis outage 500'd the whole API.** The global
  `ThrottlerGuard` used the raw Redis storage; when Redis was down `increment()`
  threw and every request 500'd. Wrapped it in `ResilientThrottlerStorage`,
  which **fails open** (allows the request, logs once) so rate limiting degrades
  instead of taking the API down. Verified: with Redis killed, `/shops` and
  `/health/ready` return 200; with Redis up, `/shops` still 429s past 10/s.
- **Bug found & fixed — `@SkipThrottle()` was a silent no-op.** With no args it
  only skips a throttler named `default`; our tiers are `short/medium/long`, so
  health, metrics, and the Stripe webhook were actually being throttled. Now use
  `@SkipThrottle(SKIP_ALL_THROTTLERS)`, derived from the tier list so it can't
  drift. (This is why high-frequency Stripe callbacks could have hit the limit.)

## PH-6 — Graceful shutdown (zero-downtime deploys)
- `main.ts` now calls `app.enableShutdownHooks()` (the worker already did). On
  SIGTERM/SIGINT — what orchestrators send during a rolling deploy — Nest stops
  accepting connections, drains in-flight requests, then runs the shutdown hooks
  (close Redis, drain the DB pool + BullMQ) so nothing is dropped or leaked.
  Verified: SIGTERM → clean exit in ~1s, no force-kill.
- Listen port is env-configurable (`PORT`, default 3000) for containerised
  deploys; existing dev/Docker/compose setups are unaffected.

## Verification gate
`npm run build` · `npm test` · `npm run test:e2e` · check-only lint on changed
files · migration applies in the prod chain. Update checkboxes here.

Status: ✅ PH-1 ✅ PH-2 ✅ PH-3 ✅ PH-4 ✅ PH-5 ✅ PH-6
