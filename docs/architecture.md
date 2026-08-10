# Architecture

## Context

This repository is a runnable trading analytics and deterministic strategy
backtesting platform. Monte Carlo simulation and genetic optimization remain
outside the current stage.

## Components

```text
Browser
  │ HTTP/JSON
  ▼
Next.js frontend ───────► FastAPI /api/v1
                              │
                              ▼
                        Application services
                         │ ports       │
                         │             ▼
                         │      Backtest domain engine
                         │      (framework independent)
                              ▼
                   SQLAlchemy repositories
                              │
                              ▼
                         PostgreSQL 16
```

The repository is split into deployable applications under `apps/`, local
runtime infrastructure under `infra/`, and technical documentation under
`docs/`.

## Backend boundaries

- `api` owns HTTP routing, request/response schemas and error translation.
- `application` coordinates use cases and defines repository protocols.
- `domain` contains typed entities, enums and business errors with no FastAPI
  or SQLAlchemy dependency.
- `infrastructure` implements configuration, logging and database adapters.

API routes do not contain persistence or trading rules. SQLAlchemy models are
kept separate from domain entities so persistence concerns do not leak into the
application layer.

## Backtesting boundary

The backtesting package under `app/domain/backtesting` has no FastAPI,
SQLAlchemy or MetaTrader imports. It contains the strategy protocol,
`StrategyContext`, signals, position/risk management, commission and
slippage models, order simulation, the sequential `BacktestEngine` and typed
results.

`HistoricalDataProvider` is a domain port. Its SQLAlchemy adapter selects one
symbol and timeframe for an inclusive date range in ascending time order. The
engine defensively filters that response again.

Strategies receive the current completed candle, history only through that
candle, balance, equity, open positions and immutable parameters. A signal is
queued and executed at the next candle open. SL/TP checks then use that candle's
OHLC data. If both levels are touched, the reproducible conservative policy is
stop-first. A final open position is closed at the last candle close.
Intrabar-dependent equity and exit events are timestamped at candle close.
Synchronous API runs are capped at 20,000 candles to bound CPU, memory,
persistence and response size.

The included moving-average crossover is an infrastructure demonstration only
and makes no profitability claim. Position size is expressed in MT5 lots and
validated against the synchronized symbol minimum, step and maximum, with an
additional platform cap of 99 lots. Profit and unrealized equity use the
symbol's MT5 contract size. SL/TP are percentages from the simulated fill,
commission is a percentage of fill notional, slippage is expressed in quote
points capped at the sixth informative price digit, and swap is a signed
percentage of entry notional for each crossed calendar day.

Before loading candles, the engine asks the provider for confirmed historical
coverage of the complete requested interval. Strict API clients are rejected
before the first strategy call when any interval is missing. Clients that set
`allow_partial_data=true` use the largest confirmed continuous overlap; the
requested and actual ranges, `data_complete` and warnings are persisted.
Confirmed overlapping or
timeframe-adjacent intervals are merged, while the immutable candle cache is
reused by later runs. This avoids treating exchange closures as missing data:
the source confirms the requested interval independently of candle cadence.

Strategy history is exposed as a read-only prefix view over one immutable
candle tuple. This preserves the no-future-data contract without copying the
entire prefix on every candle. Equity points store both percentage and absolute
drawdown; the frontend renders absolute drawdown on the same monetary axis as
equity and advances both series on the replay clock.

`GET /api/v1/database/overview` uses a dedicated application port and a
SQLAlchemy adapter. It exposes counts, schema revision, database size and
cached candle ranges only. The browser never receives database credentials and
cannot execute arbitrary SQL.

## Data model

- `symbols` is the normalized instrument catalog and stores MT5 volume minimum,
  volume step, capped volume maximum and contract size.
- `candles` belongs to a symbol and is unique by symbol, timeframe and opening
  time. Its typed `source` field (`demo`, `mt5`, or `api`) prevents
  synthetic MVP prices from being mixed into a connected terminal view.
- `historical_data_coverage` stores source-confirmed reusable intervals per
  symbol and timeframe. The lookup index follows the range-query access path.
- `historical_data_requests` is a durable site-to-terminal queue. Active exact
  ranges are deduplicated by a partial unique index; `(status, requested_at)`
  supports `FOR UPDATE SKIP LOCKED` claims and a lease recovers abandoned work.
- `accounts` identifies an external trading account.
- `trades` belongs to an account and symbol and is unique by account and
  external ticket.
- `backtest_runs` stores the requested and actual data ranges, settings,
  strategy version, parameters and final metrics.
- `backtest_trades` stores a separate virtual execution ledger and never
  mixes research fills with live/MT5 trades.
- `backtest_equity_points` stores the complete balance/equity/drawdown curve
  for each run.

Prices, volumes and monetary values use fixed-precision `NUMERIC(24, 8)` rather
than floating point. UUIDs are generated in the application.

## Runtime and demo data

Docker Compose starts PostgreSQL, applies Alembic migrations, idempotently
loads a small EURUSD/XAUUSD dataset, then starts the API and frontend. Demo
seeding is controlled by `SEED_DEMO_DATA` and can be disabled without changing
code.

## Error and logging policy

Domain errors are mapped to stable JSON error codes. Validation errors use the
same envelope, while unexpected exceptions return a generic message and are
logged with a request ID. Every request emits a structured JSON log record with
method, path, status and duration.

## MetaTrader bridge

MT5 synchronization is isolated behind application-level gateways. Protected
routes validate the bridge API key; SQLAlchemy adapters perform bounded
transactions. The data path is two-way only for orchestration: the site queues
an exact read request, while the EA returns candles or an availability error.
There are no backend ports or MQL functions for trading commands.

`mt5_terminals` stores heartbeat and synchronization timestamps. `positions`
stores the latest open-position snapshot. Existing candle and trade uniqueness
constraints are reused for retry-safe batch upserts. See
[`mt5-bridge.md`](mt5-bridge.md) for the complete contract.

Live quotes use a bounded latest-state model rather than an unbounded raw tick
table. The EA samples changed `time_msc` values in batches; only `/market-data`
mounts the 500 ms browser polling hook, and effect cleanup stops it immediately
when navigation unmounts that route. Other pages receive only their normal
low-frequency snapshots.

The same backtest router is exposed under `/api/v1/tester/backtests` for
non-browser clients. See [`backtesting-api.md`](backtesting-api.md).
