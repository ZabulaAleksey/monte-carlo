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
- Before/after source hashes, full backend/Ruff/mypy, no guarded skips during
  live DB run, image/server/version/command evidence. No raw generated credentials
  in logs/versioned evidence. No live MT5/full API E2E/Timescale/query-plan claim.
- MC6-R27 may become internally verified after native repository evidence;
  MC-REM-DB-02 stays partial for remaining access-path/query-plan coverage and
  future DB-01 tables. D1–D4/TD-BT-001/Stage7 gates stay unchanged.
