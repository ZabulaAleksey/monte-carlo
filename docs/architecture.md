# Architecture

## Context

This repository is the first runnable foundation of a trading analytics
platform. It deliberately excludes strategies, backtesting, Monte Carlo
simulation and genetic optimization.

## Components

```text
Browser
  │ HTTP/JSON
  ▼
Next.js frontend ───────► FastAPI /api/v1
                              │
                              ▼
                        Application services
                              │ ports
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

## Data model

- `symbols` is the normalized instrument catalog.
- `candles` belongs to a symbol and is unique by symbol, timeframe and opening
  time. Its typed `source` field (`demo`, `mt5`, or `api`) prevents
  synthetic MVP prices from being mixed into a connected terminal view.
- `accounts` identifies an external trading account.
- `trades` belongs to an account and symbol and is unique by account and
  external ticket.

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

MT5 synchronization is isolated behind an application-level gateway. Protected
write routes validate the bridge API key before calling `Mt5SyncService`; the
SQLAlchemy adapter performs one transaction per payload. There are no backend
ports or MQL functions for trading commands.

`mt5_terminals` stores heartbeat and synchronization timestamps. `positions`
stores the latest open-position snapshot. Existing candle and trade uniqueness
constraints are reused for retry-safe batch upserts. See
[`mt5-bridge.md`](mt5-bridge.md) for the complete contract.
