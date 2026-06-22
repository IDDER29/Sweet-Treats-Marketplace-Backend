# ADR-0004: Multi-tenancy — shared schema, row-level by business_id

- Status: Accepted
- Date: 2026-06

## Context

The platform hosts many independent bakeries (tenants) plus customers, admins and
delivery providers. Cross-tenant operations are first-class: global catalog
search, customer carts spanning discovery across sellers, admin moderation,
marketplace-wide analytics.

## Decision

**Shared schema, shared database, row-level tenancy keyed by `business_id`.** A
single set of tables; tenant-owned rows carry `business_id`. Customers and orders
reference sellers by FK. No per-tenant schemas or databases.

**The critical control:** every seller-scoped query and mutation MUST filter by
the authenticated principal's `business_id`. This is enforced by the authorization
**policy layer** (ADR-0002), not by ad-hoc `where` clauses — the missing scope is
exactly what caused the product IDOR. Consider Postgres **Row-Level Security** as
defense-in-depth later.

## Alternatives considered

- **Schema-per-tenant** — rejected; cross-tenant queries (search/admin/analytics)
  become painful or impossible, migrations multiply, connection/catalog bloat.
- **Database-per-tenant** — rejected; extreme isolation we don't need for a
  consumer marketplace; ops cost explodes; cross-tenant analytics very hard.

## Consequences

- (+) Cross-tenant reads are trivial (global search, admin, marketplace metrics).
- (+) One migration, one backup, one connection pool.
- (+) Natural future shard key (`business_id`) if ever required.
- (−) Tenant isolation is *logical*, enforced in code — a missing scope leaks
  data. Mitigation: centralized policy layer + tests asserting cross-tenant
  access returns 403/empty + (later) RLS.
- (−) "Noisy neighbor" at the DB level — mitigated by caching, read replicas and
  per-tenant rate limits.
