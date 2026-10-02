# MC-REM-DB-02 — existing PostgreSQL backtest repository evidence

Status: принят существующим reconciliation ledger и Night Factory execution.
Dependencies: existing migrations0001–0009, независимо от tick/event DB-01.
Scope: additional integration evidence existing SQLAlchemy repository;
не меняет application, schema, accepted tests, product retention или MT5.

- Guard: explicit PostgreSQL+asyncpg loopback *_test URL и disposable flag;
  no fallback to application DATABASE_URL. Query parameters are rejected entirely: asyncpg host/port/unix-socket/multihost overrides cannot bypass the loopback guard. Missing target = explicit skip,
  unsafe supplied target = FAIL before connection. Negative guard cases required.
- Native PostgreSQL17.6 private container: pinned pre-existing image identity,
  unique run label/name, ephemeral loopback port, tmpfs database, no host volume,
  finite readiness/command/resource budgets; cleanup only exact owned identity.
- Existing clean upgrade0001→0009/check/downgrade0008/reapply0009 and existing
  UTC/numeric/constraints/index test, plus actual repository add/commit/new-session
  reload/list/trades/delete, complete settings/parameters/warnings/metrics,
  BUY/SELL trade and equity rows. Deletes/cascade checks affect owned random UUIDs.
- Query-plan evidence is a separate bounded sub-slice on the existing migrations
  0001–0009. It invokes current SQLAlchemy consumers with a capture-only session,
  compiles their emitted statements, then runs those exact statements with
  `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` against fixed synthetic rows in the
  guarded disposable DB. Run `ANALYZE` after seed creation. Seed, `ANALYZE`, and
  plans remain in one transaction that is always rolled back on success or
  failure; a fresh session verifies zero run-token rows remain in every seeded
  table. This must hold even if a caller accidentally supplies another guarded
  `*_test` database. No production
  statement/schema/index/migration/dependency changes are permitted in this slice.
- Selective shapes: historical backtest candle range; historical coverage overlap;
  account-filtered ordered positions; account-filtered ordered trades; recent
  backtest-run list. Assert only the matching existing index paths when observed
  under the documented fixed cardinality. Capture, without a performance verdict,
  the global optional candle list and historical-request claim query (including
  its OR/lease predicate and `SKIP LOCKED`) to make planner behavior reviewable.
  Do not force planner settings, set sequential scans off, impose timing
  thresholds, or recommend/remove indexes based on this finite synthetic sample.
- Preserve complete PostgreSQL JSON plan trees for these synthetic queries with
  query-shape IDs, source-file hashes, server/image identity, cardinality and
  command provenance. They contain only synthetic identifiers/values; never
  include connection URLs, generated credentials, environment values, or live
  account/market records. The full plan JSON emitted by a capture is capped at
  128 KiB and must remain secret-free.
- Reuse the same strict disposable URL guard and private PostgreSQL 17.6 harness:
  explicit PostgreSQL+asyncpg loopback `*_test` URL and disposable flag; no
  fallback to application `DATABASE_URL`; missing target is an explicit skip and
  any unsafe supplied target fails before connection. Use an owned unique
  container/run label, finite resource/readiness/command limits, tmpfs database,
  no host volume, and cleanup only the exact owned identity.
- Before/after source hashes, full backend/Ruff/mypy, no guarded skips during the
  live DB run, image/server/version/command evidence. No raw generated credentials
  in logs/versioned evidence. No live MT5/full API E2E/Timescale claim.
- MC6-R27 may become internally verified after native repository evidence;
  MC-REM-DB-02 stays partial for remaining access-path/query-plan coverage and
  future DB-01 tables. D1–D4/TD-BT-001/Stage7 gates stay unchanged.
