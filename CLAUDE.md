# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                 # install dependencies

# Run
npm run start:dev           # watch mode (development)
npm run start               # run once
npm run start:prod          # run compiled output from dist/ (build first)
npm run build               # compile to dist/

# Quality
npm run lint                # eslint --fix over src, test, apps, libs
npm run format              # prettier --write over src and test

# Tests
npm test                    # all unit specs (*.spec.ts under src/)
npm run test:watch          # watch mode
npm run test:cov            # with coverage
npm run test:e2e            # e2e specs (test/*.e2e-spec.ts), boots full AppModule
npx jest src/business/business.service.spec.ts   # single file
npx jest -t "should create a new business"       # single test by name
```

The app listens on **port 3000** (hardcoded in `src/main.ts`). It needs a reachable PostgreSQL instance to boot — there is no in-memory/SQLite fallback, so `start`, `start:dev`, and `test:e2e` all fail without one.

## Environment

Config is read directly from `process.env` via `@nestjs/config` (global). There is no `.env.example`; create a `.env` with:

- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` — PostgreSQL connection (`src/app.module.ts`)
- `JWT_SECRET` — signing secret for user auth. **Falls back to the hardcoded `'mySecretKey'`** in both `user.module.ts` and `jwt.strategy.ts` if unset.

`synchronize` is enabled in dev (`NODE_ENV` not set or not `'production'`) — TypeORM auto-creates/alters tables on every boot. In production (`NODE_ENV=production`) it is disabled and `migrationsRun` takes over. See the Security section for details.

## Architecture

NestJS 10 + TypeORM (PostgreSQL). `main.ts` → `AppModule` wires the feature modules: `UserModule`, `BusinessModule`, `ProductModule`, `OrderModule`, `ReviewModule`.

A **global `ValidationPipe`** (`main.ts`) runs with `whitelist`, `forbidNonWhitelisted`, and `transform` enabled. Every request body must have a matching `class-validator` DTO; unknown properties are rejected outright. Add/adjust DTOs in the relevant `dto/` folder when changing any endpoint's accepted payload.

### Two parallel, disconnected entity sets (important)

There are effectively **two data models** in this repo, and they do not share tables:

1. **`src/entities/*`** — the full intended marketplace schema (`Users`, `Businesses`, `BusinessOwners`, `Products`, `Orders`, `OrderItems`, `Payments`, `Reviews`, `Deliveries`, `DeliveryPerson`), all `snake_case` columns and fully relational. Every one is registered in `app.module.ts`'s `TypeOrmModule.forRoot` `entities` array, so all tables get created — **but only `Users` is actually wired to code** (consumed by `UserModule`). The rest have no controllers/services; they are schema-only scaffolding.

2. **`src/business/entities/business.entity.ts` (`Business`)** and **`src/product/entities/product.entity.ts` (`Product`)** — `camelCase`, linked to each other (`Business` 1—N `Product`), and the only entities the active `BusinessModule`/`ProductModule` operate on.

Because both sets are registered, the generated database contains **both** `business` and `businesses`, **and** both `product` and `products` tables. When adding a persisted entity, register it in `app.module.ts`'s `forRoot` `entities` array **and** in the owning module's `TypeOrmModule.forFeature`.

`OrderModule` and `ReviewModule` deliberately build on the **active** set (`Users`, `Business`, `Product`) via new `Order`/`OrderItem`/`Review` entities (`src/order`, `src/review`), so the dead `src/entities/Orders|OrderItems|Reviews` remain unused duplicates. Follow this pattern (reference the active entities) for any new commerce feature.

### Modules and auth (inconsistent by design — match the module you edit)

- **`UserModule` (`/users`)** — the only module with real JWT auth. Register/login hash with bcrypt (10 rounds); login issues a signed JWT with payload `{ userId, role }`. Protected routes use `@UseGuards(AuthGuard('jwt'))` + the Passport `JwtStrategy`, which puts `{ userId, role }` on `req.user`. Uses the `Users` entity (snake_case `user_id` PK, `UserRole` enum).

- **`BusinessModule` (`/business`)** — register / `:id` / `email/:email` / login. bcrypt hashing with **12 rounds** (note: differs from UserModule's 10). **Issues no token** — `login` just returns the business record. `findById`/`login` return the full entity including the password hash.

- **`ProductModule` (`/products`)** — CRUD over `Product`, each tied to a `Business`. **`POST /products` uses an ad-hoc auth scheme, not JWT**: it reads the `Authorization: Bearer <...>` header, `JSON.parse`s the token as a stringified session object, and pulls `session.user.id` as the business id. This is unique to this endpoint; don't assume JWT here.

- **`OrderModule` (`/orders`)** — checkout, order history, and status. Customer routes (`POST /orders`, `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/cancel`) use real JWT (`AuthGuard('jwt')`, `req.user.userId`). Seller routes (`GET /orders/business/:businessId`, `PATCH /orders/:id/status`) are **not yet guarded** — pending real business auth. Prices are recomputed server-side at checkout; one order maps to exactly one business (multi-vendor carts must be split client-side).

- **`ReviewModule` (`/products/:productId/reviews`)** — `GET` (public) lists reviews; `POST` (JWT) creates one and recomputes the cached `Product.rating` (rounded int) and `reviewCount`.

## Security

Phase 11 hardening is applied. Key points:

- **Rate limiting** — `ThrottlerModule` (global `APP_GUARD`) enforces three tiers: 10 req/s (`short`), 100 req/min (`medium`), 1000 req/hr (`long`). Auth-sensitive endpoints override the defaults:
  - `POST /users/auth/login` — 5/min · 20/hr
  - `POST /users/forgot-password` — 3/min · 10/hr
  - `POST /payments/webhook` — `@SkipThrottle()` (Stripe sends high-frequency callbacks)
- **HTTP security headers** — `helmet()` middleware is applied in `main.ts` before all routes.
- **CORS** — configured via `app.enableCors()` in `main.ts`. Allowed origins default to `['http://localhost:3000', 'http://localhost:3001']`; override with the `ALLOWED_ORIGINS` env var (comma-separated).
- **JWT_SECRET warning** — on startup, if `JWT_SECRET` is not set, a `console.warn` fires reminding you to set it. The app does not crash (dev-friendly), but the insecure fallback `'mySecretKey'` is in use.
- **synchronize disabled in production** — `TypeOrmModule` uses `synchronize: process.env.NODE_ENV !== 'production'`. When `NODE_ENV=production`, `synchronize` is `false` and `migrationsRun` is `true` (looks for compiled migrations in `dist/migrations/*.js`). In dev (default), auto-sync is still on for convenience.

## Gotchas

- **The test suite passes** (`npm test` for unit specs, `npm run test:e2e` for the integration suite). The unit specs cover `UsersService`/`BusinessService` (incl. the auth/security fixes) and `app.controller`; the e2e suite (`test/smoke.e2e-spec.ts`) boots the full `AppModule` against a real PostgreSQL instance and exercises auth, RBAC, analytics, the commerce flow, and security/commerce regressions. The old auto-generated controller specs were stale (wrong symbols, missing DTO fields) and were removed/replaced. `test:e2e` is pinned to `maxWorkers: 1` so the two app-booting suites don't race on TypeORM `synchronize`. There are still no specs for the `admin`/`analytics`/`upload`/`custom-order`/`category`/`mail` modules — see `IMPROVEMENT_PLAN.md`.
- TypeScript is loose here: `strictNullChecks`, `noImplicitAny`, and `strictBindCallApply` are all **off** (`tsconfig.json`), and eslint disables `no-explicit-any`.
- See **`IMPROVEMENT_PLAN.md`** for the audit findings, what has been fixed, and the prioritised roadmap for what remains (e.g. the NestJS 11 upgrade).
