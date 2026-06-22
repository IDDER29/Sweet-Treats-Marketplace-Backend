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

## 🔜 Still recommended (contained)

### Money handling end-to-end  ·  `payment.service.ts`, `order.service.ts`
Columns are correctly `decimal(10,2)` and the Stripe amount is derived from the
frozen `order.totalAmount` (so it can't drift from client input), but the math
still goes through JS `Number`. For full safety, carry money as integer minor
units (or `decimal.js`) through checkout and the Stripe conversion, and assert
the intent amount equals the stored total before charging.

### Validate percentage discount value at creation  ·  `discount.service.ts`
The checkout already clamps a >100% code, but rejecting `value > 100` for
`PERCENTAGE` at creation time gives a clearer error (the DTO can't do it alone
because `FIXED_AMOUNT` legitimately exceeds 100).

---

## 🧭 Larger / strategic (unchanged — own PRs)

### Remove the dead duplicate entity set
`src/entities/*` (snake_case `Businesses`, `Products`, `Orders`, `OrderItems`,
`Payments`, `Reviews`, `Deliveries`, `DeliveryPerson`, `BusinessOwners`) are
schema-only scaffolding — only `Users` is used, yet they are registered in
`app.module.ts`, so the DB carries duplicate tables (`business` **and**
`businesses`, etc.). Remove the unused entities + their registrations, keep
`Users`, and ship a migration dropping the dead tables. Destructive — own PR,
backup first.

### NestJS 10 → 11 upgrade
Clears the remaining high advisories (`@nestjs/platform-express`/`multer`, plus
dev-tooling `glob`/`tmp`/`picomatch`/`@nestjs/cli`). Framework major — own branch,
full regression pass.

### `CHECK` constraints on money columns
Add `CHECK (price >= 0)` / `CHECK ("totalAmount" >= 0)` in the next migration
(belt-and-braces over the DTO/service validation).

### Tests & observability
- No tests for `admin`, `analytics`, `upload`, `custom-order`, `category`, `mail`.
  Extend the `test/smoke.e2e-spec.ts` harness (now also covers the security
  regressions and is the template to follow).
- The legacy unit specs under `src/**/*.spec.ts` are stale (wrong export names,
  missing DTO fields) — fix or delete so `npm test` is meaningful.
- Add audit logging on admin actions and structured request logging.

---

## Suggested order of execution
1. **🔜 Still recommended** — money handling + creation-time discount validation.
2. **🧭 CHECK constraints** — fold into the next migration.
3. **🧭 Dead-entity removal** — own PR, destructive migration, backup first.
4. **🧭 Nest 11 upgrade** — own branch, full regression.
5. **🧭 Tests** — backfill alongside each change above.
