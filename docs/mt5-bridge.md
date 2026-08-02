# MetaTrader 5 bridge

## Security boundary

The bridge is one-way: MetaTrader sends observations to FastAPI. The backend
does not expose order-placement, order-modification, or position-closing
commands. Every write request must include `X-MT5-API-Key`; the expected value
is loaded from `MT5_API_KEY` as a Pydantic `SecretStr` and compared with a
constant-time comparison.

Use a unique random value of at least 32 characters. Never put it in source
control, MQL logs, screenshots, or `NEXT_PUBLIC_*` variables. The public status
endpoint reveals connection timestamps but never authentication material.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/mt5/heartbeat` | Record terminal liveness and build |
| `POST` | `/api/v1/mt5/account` | Upsert account metrics |
| `POST` | `/api/v1/mt5/symbols` | Upsert the symbol catalog |
| `POST` | `/api/v1/mt5/candles/batch` | Upsert up to 1,000 candles |
| `POST` | `/api/v1/mt5/positions` | Replace an account's open-position snapshot |
| `POST` | `/api/v1/mt5/trades/batch` | Upsert up to 1,000 history records |
| `GET` | `/api/v1/mt5/status` | Read connection state for the frontend |

All timestamps must be timezone-aware and no more than five minutes in the
future. Price fields must be positive, volume must be non-negative for candles
and positive for positions and trades, and OHLC ranges must be internally
consistent.

## Idempotency

- Symbols use their normalized uppercase name.
- Candles use `(symbol_id, timeframe, open_time)`.
- A successful MT5 candle upsert sets `source=mt5`, including when it replaces
  a matching candle that was previously marked as demo data.
- Trades use `(account_id, external_id)`.
- Positions use `(account_id, external_id)` and are treated as a complete
  current snapshot. Positions omitted from a later snapshot are removed.
- Terminals and accounts use their external identifiers.

The database keeps unique constraints as the final safety boundary. The
application also resolves existing records before a single batch commit so a
retry updates records instead of creating duplicates.

## Connection state

Heartbeat receipt uses backend time, while terminal time is stored separately
for diagnostics. A terminal is considered stale when no heartbeat has been
received within `MT5_HEARTBEAT_TIMEOUT_SECONDS` (90 seconds by default). Data
uploads update `last_sync_at`; heartbeat updates `last_heartbeat_at`.

## Expert Advisor setup

See [`mt5/README.md`](../mt5/README.md). The EA sends only completed candles,
account state, open-position snapshots and history deals. It retries network
errors, HTTP 408, 429 and 5xx responses. Client errors are not retried because
they require configuration or payload correction.

All three connection settings are present in the repository-root
`.env.example`, `mt5/config.example`, and the MQL5 input declarations:
`BridgeBaseUrl`, `BridgeTerminalId`, and `MT5_API_KEY`. Copy the example
files to `.env` and `mt5/config.local`; never put a real key in either
tracked example file.

Before attaching it to a chart, add the backend origin to MetaTrader's allowed
WebRequest URLs. The function is unavailable in Strategy Tester, so use a demo
terminal for integration testing.
