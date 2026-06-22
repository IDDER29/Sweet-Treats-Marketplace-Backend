# ADR-0002: Unified authentication & authorization

- Status: Accepted (phased; authorization layer first)
- Date: 2026-06

## Context

Two parallel auth systems exist today:
- `UserModule` — JWT (`AuthGuard('jwt')`), payload `{ userId, role }`.
- `BusinessModule` — separate `business-jwt` strategy, payload `{ businessId }`.

They use different secrets-loading, different bcrypt costs (10 vs 12), long-lived
bearer tokens (1h/7d), and a hardcoded `mySecretKey` fallback (now hard-failed in
prod). Authorization is enforced by ad-hoc `where`/ownership checks scattered
across services — the root cause of the product IDOR bug that was patched
case-by-case.

## Decision

Move to **one identity and one token model**, and a **two-layer authorization**
model. Phased because the token changes need Redis and frontend coordination.

**Identity & tokens (phase 2, needs Redis):**
- A business owner is a `User` with role `BUSINESS_OWNER` linked to a `Business`
  (keep the `Business` entity for seller data; unify *authentication*, not the
  whole data model).
- **Access JWT**: short-lived (10–15 min), asymmetric **RS256/EdDSA** (sign with
  private key, verify with public key — no shared secret to leak), small claims
  (`sub`, `roles`, `businessId?`, `jti`).
- **Refresh token**: opaque, rotating, stored server-side in Redis; httpOnly
  Secure SameSite=Lax cookie (web) / secure storage (mobile); **reuse-detection**
  revokes the whole token family.
- bcrypt cost **12 everywhere**; MFA (TOTP) for `ADMIN` now, optional for sellers;
  social login (Google/Apple) deferred to growth → same identity.

**Authorization (phase 1, no infra — implement first):**
- **Layer 1 — role guard**: can this role reach this route?
- **Layer 2 — resource policy/ownership guard**: does this principal own/!have
  access to *this specific resource*? A reusable `@CheckPolicy('order:cancel')`
  + `PolicyHandler` that loads the resource and asserts
  `ownerId === sub || businessId === principal.businessId`.
- Mass-assignment defense stays: DTO whitelist (`forbidNonWhitelisted`), never
  accept `role`/`businessId`/`isAdmin` from the client.

## Alternatives considered

- **Merge `User` and `Business` into one table** — rejected. Products/orders link
  to `Business`; merging is a massive, high-risk data-model change for little
  gain. Unify the token/guard layer instead.
- **Keep symmetric HS256** — rejected for prod; a single leaked secret forges
  admin tokens. RS256 lets verifiers hold only the public key.
- **Stateless refresh (long-lived JWT)** — rejected; cannot revoke. Server-side
  rotating refresh in Redis gives revocation + reuse-detection.

## Consequences

- (+) One auth surface; IDOR becomes structurally hard (policy layer), not a
  game of whack-a-mole.
- (+) Short tokens + rotation dramatically shrink token-theft blast radius.
- (−) Refresh rotation needs Redis (ADR-0003 infra) and a client refresh flow —
  coordinate with the frontend; ship behind a versioned auth endpoint.
- (−) RS256 key management (rotation via `kid`, secrets manager).

## Rollout

1. ✅ **Done:** policy/ownership authorization layer (`assertOwnership`); bcrypt
   standardized to 12; short-lived access token (15m) + single-use rotating
   refresh tokens stored in Redis (`/auth/refresh`, `/auth/logout`).
2. **Growth:** fold business auth into the unified identity/token model; MFA;
   social login; org/team memberships; API keys.

### Note on HS256 vs RS256 (refinement)

For the **modular monolith**, the access token is signed and verified by the same
process, so **HS256 with a strong secret + short TTL + revocable refresh** is the
pragmatic choice (implemented). RS256's benefit — verifiers holding only the
public key — matters once verification happens **outside** the signing service (an
API gateway or extracted microservices). Adopt RS256 at that service-split point;
until then it adds key-management overhead without security benefit.
