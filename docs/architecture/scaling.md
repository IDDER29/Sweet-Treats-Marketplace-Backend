# Database scaling: connection pooling & read replicas

Two independent levers for scaling the Postgres tier. Both are **opt-in via env**
— with nothing set, the app uses a single direct connection exactly as before, so
dev/test/CI are unaffected.

```
              ┌─────────────┐      writes / migrations      ┌────────────┐
  API/worker ─┤  PgBouncer   ├──────────────────────────────┤  master    │
   replicas   │ (txn pool)   │                               └────────────┘
              └─────────────┘      reads (round-robin)       ┌────────────┐
                                  ────────────────────────────┤  replica 1 │
                                                              ├────────────┤
                                                              │  replica N │
                                                              └────────────┘
```

## 1. PgBouncer — connection pooling

Postgres costs a backend process (~10MB) per connection. With several API + worker
replicas, each holding a TypeORM pool, raw connection counts balloon and starve the
DB. PgBouncer multiplexes thousands of client connections onto a small server pool.

- **Mode: `transaction`** — a server connection is held only for the life of a
  transaction. Highest reuse, ideal for a stateless request/response API. The app
  was verified to run end-to-end through a transaction-mode PgBouncer (including
  TypeORM checkout transactions with pessimistic locks and the parameterized
  full-text search).
- **Config:** [`infra/pgbouncer/pgbouncer.ini`](../../infra/pgbouncer/pgbouncer.ini)
  is the canonical reference (auth via `auth_query` recommended over a static
  `userlist.txt`). `docker compose --profile scale up` starts a PgBouncer mirroring
  it; point the app at it with `DB_HOST=pgbouncer DB_PORT=6432`.
- **Transaction-mode caveats** (all handled): no session-level state across
  transactions (no `SET` that must persist, no session advisory locks — the app
  uses *transaction* advisory/row locks); `ignore_startup_parameters` covers
  benign client params; `max_prepared_statements` lets PgBouncer 1.21+ pass the
  unnamed prepared statements node-postgres emits.

## 2. Read replicas — read/write splitting

Set **`DB_REPLICA_HOSTS`** to a comma-separated list of `host` or `host:port`
(port defaults to `DB_PORT`). `buildTypeOrmOptions()`
([`src/common/typeorm.config.ts`](../../src/common/typeorm.config.ts)) then enables
TypeORM replication:

- **Writes, transactions, and migrations → master** (`DB_HOST`).
- **`SELECT`s → replicas**, picked per query. Streaming replication off the master.

```bash
DB_HOST=master.db.internal
DB_REPLICA_HOSTS=replica-a.db.internal,replica-b.db.internal:5432
```

**Caveats**
- *Replication lag*: a read issued immediately after a write may hit a replica
  that hasn't caught up (read-your-writes). For flows needing immediate
  consistency, run the read inside the same transaction as the write (TypeORM
  routes in-transaction reads to master), or read back through the master.
- Replicas are read-only; any write accidentally routed to one will error — a
  useful guardrail.

## Composing the two

In production the app connects to **PgBouncer**, and PgBouncer (or separate
PgBouncer pools) front the **master and replicas**. The two levers are orthogonal:
pooling reduces connection pressure; replicas add read throughput. Add PgBouncer
first (cheap, immediate), replicas when read load on the master dominates.

See Phase 8 of the [implementation backlog](./IMPLEMENTATION_BACKLOG.md).
