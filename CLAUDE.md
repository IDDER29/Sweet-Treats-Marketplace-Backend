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

`synchronize: true` is enabled, so TypeORM auto-creates/alters tables from entity definitions on every boot. Convenient in dev, destructive in prod — disable before any production use.

## Architecture

NestJS 10 + TypeORM (PostgreSQL). `main.ts` → `AppModule` wires three feature modules: `UserModule`, `BusinessModule`, `ProductModule`.

A **global `ValidationPipe`** (`main.ts`) runs with `whitelist`, `forbidNonWhitelisted`, and `transform` enabled. Every request body must have a matching `class-validator` DTO; unknown properties are rejected outright. Add/adjust DTOs in the relevant `dto/` folder when changing any endpoint's accepted payload.

### Two parallel, disconnected entity sets (important)

There are effectively **two data models** in this repo, and they do not share tables:

1. **`src/entities/*`** — the full intended marketplace schema (`Users`, `Businesses`, `BusinessOwners`, `Products`, `Orders`, `OrderItems`, `Payments`, `Reviews`, `Deliveries`, `DeliveryPerson`), all `snake_case` columns and fully relational. Every one is registered in `app.module.ts`'s `TypeOrmModule.forRoot` `entities` array, so all tables get created — **but only `Users` is actually wired to code** (consumed by `UserModule`). The rest have no controllers/services; they are schema-only scaffolding.

2. **`src/business/entities/business.entity.ts` (`Business`)** and **`src/product/entities/product.entity.ts` (`Product`)** — `camelCase`, linked to each other (`Business` 1—N `Product`), and the only entities the active `BusinessModule`/`ProductModule` operate on.

Because both sets are registered, the generated database contains **both** `business` and `businesses`, **and** both `product` and `products` tables. When adding a persisted entity, register it in `app.module.ts`'s `forRoot` `entities` array **and** in the owning module's `TypeOrmModule.forFeature`.

### Modules and auth (inconsistent by design — match the module you edit)

- **`UserModule` (`/users`)** — the only module with real JWT auth. Register/login hash with bcrypt (10 rounds); login issues a signed JWT with payload `{ userId, role }`. Protected routes use `@UseGuards(AuthGuard('jwt'))` + the Passport `JwtStrategy`, which puts `{ userId, role }` on `req.user`. Uses the `Users` entity (snake_case `user_id` PK, `UserRole` enum).

- **`BusinessModule` (`/business`)** — register / `:id` / `email/:email` / login. bcrypt hashing with **12 rounds** (note: differs from UserModule's 10). **Issues no token** — `login` just returns the business record. `findById`/`login` return the full entity including the password hash.

- **`ProductModule` (`/products`)** — CRUD over `Product`, each tied to a `Business`. **`POST /products` uses an ad-hoc auth scheme, not JWT**: it reads the `Authorization: Bearer <...>` header, `JSON.parse`s the token as a stringified session object, and pulls `session.user.id` as the business id. This is unique to this endpoint; don't assume JWT here.

## Gotchas

- **The existing test suite is largely stale scaffolding and does not pass as-is.** Several specs reference symbols that no longer exist or assert outdated shapes — e.g. `user.service.spec.ts`/`user.controller.spec.ts` import `UserService`/`UserController` (actual exports are `UsersService`/`UsersController`), `business.service.spec.ts` expects return shapes the service no longer produces, and `business.controller.spec.ts` builds `CreateBusinessDto` objects missing required fields (won't type-check). Treat tests as a starting point to fix, not a green baseline; `app.controller.spec.ts` is the one that reflects current code.
- `business.service.ts` `login` returns the message `'Login successful asds'` (typo present in code; some stale tests expect `'Login successful'`).
- TypeScript is loose here: `strictNullChecks`, `noImplicitAny`, and `strictBindCallApply` are all **off** (`tsconfig.json`), and eslint disables `no-explicit-any`.
