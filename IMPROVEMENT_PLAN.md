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

## 🔜 Recommended next (high value, contained)

### 1. Enforce per-customer discount limits  ·  `order.service.ts`, `discount.service.ts`
`maxUsesPerCustomer` is currently **not enforced**: checkout increments
`DiscountCode.usedCount` but never writes a `DiscountCodeUsage` row, so the
per-customer check always sees 0. Inside the checkout transaction, after applying
a code: (a) count this customer's `DiscountCodeUsage` for the code and reject if
`>= maxUsesPerCustomer`; (b) insert a `DiscountCodeUsage` row. Decrement/clean it
up in `releaseOrderResources` alongside `usedCount`. The unused
`DiscountService.applyDiscount` should be removed or made the single source of truth.

### 2. Single-use password-reset tokens  ·  `user.service.ts`
Reset tokens are JWTs reusable for the full 1h window. Add a `passwordChangedAt`
column (or a used-token store) and reject a reset token issued before the last
password change. Cheapest version: include `pwdVersion` in the token and bump it
on every password change.

### 3. FK indexes (query performance)  ·  entity files
Add `@Index()` to frequently-filtered FKs and lookups:
- `order.entity.ts` — `customer` (customer order history scans the table).
- `product.entity.ts` — `business` (storefront-by-business).
- `review.entity.ts` — `product` and `user`.
- `business.entity.ts` — `email` (login lookup).
After adding, regenerate an **incremental** migration (`npm run migration:generate
-- src/migrations/AddIndexes`) against a DB at InitialSchema state.

### 4. Account deletion strategy  ·  `user.service.ts`, entities
`deleteAccount` hard-deletes; with related orders/reviews it will either fail on
FK constraints or (if cascades are added) destroy order history. **Do not blanket
`onDelete: CASCADE`.** Prefer **soft-delete** (`deletedAt` + filter) for
`Users`/`Business`, keeping financial/order records intact. Decide an explicit
`onDelete` per relation: `RESTRICT` for order/payment history, `CASCADE` only for
truly dependent rows (e.g. `DiscountCodeUsage`).

### 5. Bound & validate query params  ·  admin / analytics / product controllers
- Admin `getAllBusinesses/Users/Orders` and `ProductQueryDto`: cap `limit`
  (`@Max(100)`), floor `page` (`@Min(1)`), and use a shared `PaginationDto`.
- `analytics.controller.ts`: validate `from`/`to` with `@IsDateString()` via a DTO
  instead of passing raw strings to `new Date()`.

### 6. Money handling hardening  ·  `payment.service.ts`, `order.service.ts`
Columns are correctly `decimal(10,2)`, but JS `Number` math + the `* 100` pence
conversion for Stripe risks rounding. Use integer minor units (or `decimal.js`)
for the Stripe amount, and assert the payment-intent amount equals the stored
`order.totalAmount` before charging.

### 7. Stripe webhook idempotency  ·  `payment.service.ts`
Two concurrent `payment_intent.succeeded` deliveries can both pass the
`status !== SUCCEEDED` check. Process the webhook in a transaction with a row lock
on the payment, or dedupe on the Stripe event id.

---

## 🧭 Larger / strategic

### 8. Remove the dead duplicate entity set
`src/entities/*` (snake_case `Businesses`, `Products`, `Orders`, `OrderItems`,
`Payments`, `Reviews`, `Deliveries`, `DeliveryPerson`, `BusinessOwners`) are
schema-only scaffolding — only `Users` is used. They are registered in
`app.module.ts`, so the DB carries duplicate tables (`business` **and**
`businesses`, etc.). Remove the unused entities + their `app.module` registrations,
keep `Users`, and ship a migration that drops the dead tables. Reduces confusion
and storage; eliminates "which table is canonical?" risk. (Do this deliberately,
with a backup, as it's a destructive migration.)

### 9. Order status state machine  ·  `order.service.ts`
Make `DELIVERED` an explicit terminal state in `validTransitions`, and route the
refund-driven cancellation through the same transition validation so there is one
authority for status changes.

### 10. NestJS 10 → 11 upgrade
Clears the remaining high advisories (`@nestjs/platform-express`/`multer`, plus
dev-tooling `glob`/`tmp`/`picomatch`/`@nestjs/cli`). This is a framework major —
do it on its own branch with a full regression pass, not as a security patch.

### 11. Schema niceties (with the next migration)
- `product.rating` is `int` (rounds the average); widen to `decimal(3,2)`.
- Add `CHECK (price >= 0)` / `CHECK (totalAmount >= 0)` constraints.
- Add `@UpdateDateColumn updatedAt` to `Business` (audit suspension changes).

### 12. DTO bounds & validation polish
- `submit-quote.dto.ts`: `@Max` on `quotedPrice`, `@MaxLength` on notes, ensure
  `quoteExpiresAt` is in the future.
- `create-custom-order.dto.ts`: `@Max` on `servings`.
- `suspend-business.dto.ts`: `@MaxLength` on `reason`.
- `verify-hygiene.dto.ts`: `@IsDateString()` on the expiry.
- `create-review.dto.ts`: `@MaxLength` on `comment`.
- Validate percentage discount value `<= 100` at creation time (defence-in-depth
  on top of the checkout clamp).

### 13. Category unique-conflict handling  ·  `category.service.ts`
Catch the unique-violation on `name`/`slug` and throw `ConflictException` (409)
instead of surfacing a raw DB error.

### 14. Upload hardening  ·  `upload`, `storage.service.ts`
Validate the file extension against an explicit whitelist (`jpg/jpeg/png/webp`)
and enforce a max size.

### 15. Tests & observability
- No tests for `admin`, `analytics`, `upload`, `custom-order`, `category`, `mail`.
  Add e2e coverage (the `test/smoke.e2e-spec.ts` harness is a good template).
- The legacy unit specs under `src/**/*.spec.ts` are stale (wrong export names,
  missing DTO fields) — fix or delete them so `npm test` is meaningful.
- Add audit logging on admin actions and structured request logging.

---

## Suggested order of execution
1. **🔜 1–7** — contained security/correctness wins, each independently shippable.
2. **🧭 9, 11, 12, 13, 14** — fold the schema changes into one migration.
3. **🧭 8** — dead-entity removal (own PR, destructive migration, backup first).
4. **🧭 10** — Nest 11 upgrade (own branch, full regression).
5. **🧭 15** — backfill tests alongside each change above.
