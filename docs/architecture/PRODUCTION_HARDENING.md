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

## PH-5 — Redis-aware readiness
- `/health/ready` reports Redis status (degraded, not failed, since Redis is
  optional) so orchestrators see the real picture.

## Verification gate
`npm run build` · `npm test` · `npm run test:e2e` · check-only lint on changed
files · migration applies in the prod chain. Update checkboxes here.

Status: ✅ PH-1 ✅ PH-2 ✅ PH-3 ⬜ PH-4 ⬜ PH-5
