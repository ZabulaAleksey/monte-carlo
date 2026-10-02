# Testing contracts

## PostgreSQL backtest query plans (MC-REM-DB-02)

The opt-in integration test `apps/backend/tests/test_postgres_query_plans.py`
captures SQLAlchemy statements from current repository/provider consumers, then
runs those exact statements with PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, FORMAT
JSON)` against bounded synthetic rows. Its selective access-path assertions and
observational-only shapes are defined in the
[`PostgreSQL backtest evidence SPEC`](../specs/features/postgres-backtest-evidence.spec.md).

Without an explicit test target, pytest reports a guarded skip. For a native
run, provide `MC_TEST_POSTGRES_URL` as a PostgreSQL+asyncpg loopback URL for a
disposable database ending in `_test`, and set `MC_TEST_DISPOSABLE=1`. Query
parameters are rejected; the test does not fall back to application
`DATABASE_URL`. An unsafe supplied URL fails before connecting. Use a uniquely
owned disposable PostgreSQL container with no host volume and remove only that
container after the run. Seed rows, `ANALYZE`, and plans share one transaction
that the test explicitly rolls back even after successful capture; a fresh
session checks that no run-token rows remain in the seeded tables.

Set `MC_QUERY_PLAN_CAPTURE_JSON=1` only for a review capture. The test emits the
complete bounded plan trees with source hashes, query-shape IDs, PostgreSQL
version, and fixed synthetic cardinalities; the capture is capped at 128 KiB.
The plans may contain generated
synthetic identifiers; they must not contain connection URLs, credentials,
environment values, or live market/account data. Capture files belong under
`docs/evidence/` only after checking their contents for those exclusions.

The query-plan result is evidence about the named statement shapes under that
synthetic cardinality. It does not prove production distributions or response
times, and it does not authorize planner forcing, index changes, or conclusions
about unmeasured paths.
