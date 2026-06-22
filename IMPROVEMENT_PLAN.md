# Backend Improvement Plan

A full audit of the Sweet Treats backend (auth/security, commerce correctness,
data model/architecture, code quality) was run across every module. This
document records **what was fixed** and a **prioritised roadmap** for the rest,
with exact file references so each item can be picked up directly.

Status legend: ✅ done in this session · 🔜 recommended next · 🧭 larger/strategic.

---

## ✅ Fixed in this session

### Boot & runtime (the app now actually runs)
- Installed missing `passport` runtime dep; fixed `HandlebarsAdapter` import;
  removed an invalid `JwtService` export; enabled `esModuleInterop` (Stripe/helmet);
  Stripe placeholder fallback; **JWT secret read after `.env` loads** (`registerAsync`)
  so JWT auth actually verifies; nullable `users.address/phone_number`; fixed
  `FOR UPDATE` on the nullable side of a LEFT JOIN in checkout.

### Production migration path
- Added `src/data-source.ts`, generated `src/migrations/*-InitialSchema.ts`
  (all tables + FKs), and `migration:generate|run|revert` scripts. Verified by
  booting `NODE_ENV=production` against an empty DB (migrations build the schema).

### Email templates
- Redesigned all four `.hbs` emails (table layout, inline CSS, branded). Bundled
  to `dist` via `nest-cli.json` assets + `join(__dirname, 'templates')`.

### Dependency vulnerabilities
- Criticals **2 → 0**, highs **21 → 6** (bcrypt 6, nodemailer 9 override,
  multer 2, `@nestjs/config` 4). Remaining 6 highs are dev-tooling or need the
  Nest 10→11 major (see 🧭 below).

### Security (auth / authorization)
- **Product update/delete IDOR** — any business could edit/delete any product;
  now verifies `req.user.businessId` ownership. `product.service.ts` / `product.controller.ts`.
- **Profile leaked the password hash** — `getProfile` now strips it. `user.service.ts`.
- **`changePassword` null-deref / `updateProfile` silent no-op** — added not-found checks.
- **Production refuses to boot without `JWT_SECRET`** — `main.ts`.
- **Category creation is admin-only** (`RolesGuard`) — `category.controller.ts`.
- **`reset-password` is rate-limited** — `user.controller.ts`.

### Commerce correctness
- **Refunds restore stock + delivery slot + discount usage** (was leaking
  inventory) — centralised in `OrderService.cancelForRefund`, called by `PaymentService`.
- **Cancellation is transactional** and also decrements discount usage; shared
  idempotent `releaseOrderResources` helper.
- **Latent slot-release bug** — raw SQL used `booked_count` but the column is
  camelCase `bookedCount`; switched to `decrement()`.
- **Reviews require a verified purchase** (PAID/SHIPPED/DELIVERED order) and are
  **one-per-customer-per-product** — `review.service.ts`.
- **Percentage discounts clamped to subtotal** so a >100% code can't make the
  total negative — `order.service.ts`.
- Regression e2e added (password not leaked, product IDOR → 403, review without
  purchase → 403). Suite is 19/19 green.

---

## ✅ Fixed in this session — wave 2 (the "recommended next" list)

- **Per-customer discount limits enforced** — checkout now records a
  `DiscountCodeUsage` row and rejects past `maxUsesPerCustomer`; cancel/refund
  removes it. `order.service.ts`.
- **Single-use password-reset tokens** — signed with a per-user secret bound to
  the current password hash, so a token dies once the password changes.
  `user.service.ts`.
- **FK indexes added** — `order(customer, createdAt)`, `product(business)`,
  `review(product)`, unique `review(user, product)`, `business(email)`.
- **Account deletion is now soft-delete** (`@DeleteDateColumn` on `Users`;
  `softDelete()`), preserving order/review history and avoiding the FK dilemma —
  **not** blanket cascade.
- **Query params bounded** — shared `PaginationQueryDto` for admin lists,
  validated `AnalyticsQueryDto` (dates + capped limit), product `limit` ≤ 100.
- **Stripe webhook is race-safe** — atomic conditional UPDATE claims the
  PAID transition. `payment.service.ts`.
- **Order FSM** lists `DELIVERED`/`CANCELLED` as explicit terminal states.
- **`product.rating` widened to `decimal(3,2)`** (no longer rounds to whole
  stars); `business.updatedAt` added.
- **Category create → 409** on unique violation.
- **Upload key extension derived from the validated mimetype**, never the
  client filename.
- **DTO bounds** on review comment, suspend reason, hygiene date, custom-order
  servings, quote price/notes; **percentage discounts clamped to subtotal**.
- New migration `*-AddIndexesSoftDeleteRating.ts` (generated + verified against a
  DB at InitialSchema state, edited to widen `rating` in place so existing data
  is preserved). e2e config pinned to `maxWorkers: 1` to avoid a concurrent-
  `synchronize` race between the two e2e suites.

---

## ✅ Fixed in this session — wave 3

- **Zero/negative payment guard** + `toMinorUnits` helper in `payment.service.ts`
  (a free order no longer reaches Stripe with a 0 amount).
- **Percentage discount value > 100 rejected at creation** (`discount.service.ts`),
  on top of the existing checkout clamp.
- **DB `CHECK` constraints** `product.price >= 0` and `order.totalAmount >= 0`
  (migration `AddMoneyCheckConstraints`, verified — negative price is rejected).
- **Removed the dead duplicate entity set** — deleted the 9 unused snake_case
  scaffolding entities, dropped them from `app.module`, and added migration
  `DropDeadEntityTables` to drop the duplicate tables. The active schema now
  matches the entity set exactly (`migration:generate` reports no changes).
- Refreshed `@nestjs/cli`/`@nestjs/schematics` to latest v10 (build-time only).

---

## 🔜 Still recommended (contained)

### Money handling fully in minor units  ·  `payment.service.ts`, `order.service.ts`
The Stripe amount is now guarded and derived from the frozen `order.totalAmount`,
but checkout math still flows through JS `Number`. For belt-and-braces, carry
money as integer minor units (or `decimal.js`) through checkout and assert the
intent amount equals the stored total before charging.

---

## 🧭 Larger / strategic (own PRs)

### NestJS 10 → 11 upgrade — the only remaining vuln blocker
After this session the audit is **0 critical / 6 high** (down from 2 / 21). All 6
remaining highs are fixable *only* by the Nest 11 ecosystem major:
- `@nestjs/platform-express` + `multer` (runtime) — need platform-express 11.
- `@nestjs/cli`, `glob`, `tmp`, `picomatch` (dev/build-time only — never run in
  production) — need the v11 CLI/schematics.

This is intentionally **not** done here because it is a framework major with real
breakage, requiring a human-reviewed PR and full regression:
- Nest 11 brings **Express 5** (new path-to-regexp). The upload route
  `@Delete(':key(*)')` in `upload.controller.ts` uses Express-4 wildcard syntax
  that is **invalid in Express 5** and must be rewritten (e.g. a splat param).
- Node 20+ is required; throttler/passport/validation integrations should be
  re-verified.

Do it on its own branch: bump all `@nestjs/*` to 11 + `@nestjs/cli`/`schematics`
to 11, fix the wildcard route, run the full e2e suite, and smoke-test uploads
and rate-limiting before merging.

### Tests & observability
- ✅ `npm test` is now real and green — stale auto-generated specs were
  replaced with proper `UsersService`/`BusinessService` unit tests (covering the
  auth/security fixes) and the dead controller specs removed.
- ✅ e2e now also covers commerce-fix regressions (cancel restores stock,
  per-customer discount limit) on top of auth/RBAC/analytics/security. 44 tests
  total (23 unit + 21 e2e).
- Still no specs for `admin`, `analytics`, `upload`, `custom-order`, `category`,
  `mail` — extend the `test/smoke.e2e-spec.ts` harness (the template to follow).
- Add audit logging on admin actions and structured request logging.

---

## Suggested order of execution
1. **🔜 Money in minor units** — the last contained polish item.
2. **🧭 Nest 11 upgrade** — own branch, full regression (clears the final 6 highs).
3. **🧭 Tests** — backfill module coverage and fix/remove the stale unit specs.
