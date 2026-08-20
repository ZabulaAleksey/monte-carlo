# MetaTrader 5 bridge

## Security boundary

The bridge is read-only but data orchestration is two-way: MetaTrader sends
observations to FastAPI, while the terminal polls for exact historical-data
requests created by the site or tester API. The backend does not expose
order-placement, order-modification, or position-closing commands. Every MT5
request must include `X-MT5-API-Key`; the expected value
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
| POST | /api/v1/mt5/symbols | Upsert symbols with lot limits and contract size |
| `POST` | `/api/v1/mt5/candles/batch` | Upsert up to 1,000 candles |
| `POST` | `/api/v1/mt5/candles/coverage` | Confirm a fully stored candle range |
| `POST` | `/api/v1/mt5/quotes` | Upsert the latest Bid/Ask per symbol |
| `GET` | `/api/v1/mt5/history/requests/next` | Atomically claim the next requested range |
| `POST` | `/api/v1/mt5/history/requests/{id}/complete` | Confirm uploaded request candles |
| `POST` | `/api/v1/mt5/history/requests/{id}/fail` | Report unavailable broker history |
| `POST` | `/api/v1/mt5/positions` | Replace an account's open-position snapshot |
| `POST` | `/api/v1/mt5/trades/batch` | Upsert up to 1,000 history records |
| `GET` | `/api/v1/mt5/status` | Read connection state for the frontend |
| `GET` | `/api/v1/positions` | Read current open positions, optionally by account |

All timestamps must be timezone-aware and no more than five minutes in the
future. Price fields must be positive, volume must be non-negative for candles
and positive for positions and trades, and OHLC ranges must be internally
consistent.

## Idempotency

- Symbols use their normalized uppercase name.
- Candles use `(symbol_id, timeframe, open_time)`.
- Quotes keep one latest Bid/Ask record per symbol. An observation older than
  the stored quote is ignored.
- Quote batches contain only symbols whose `time_msc` changed. By default the
  EA subscribes to all broker symbols and samples changed ticks every 500 ms.
  Raw tick history is deliberately not persisted: PostgreSQL stores one bounded
  latest snapshot per symbol.
- A successful MT5 candle upsert sets `source=mt5`, including when it replaces
  a matching candle that was previously marked as demo data.
- Initial candle synchronization covers CandleLookbackDays and is split into
  batches no larger than 1,000 records. Subsequent synchronization is
  incremental from the last successfully uploaded candle.
- After all batches, the EA reports the actual first copied time, requested end
  and copied count. The backend verifies that at least this many MT5 candles
  were stored before recording coverage. A failed confirmation rewinds the
  in-memory cursor so the next timer retries the idempotent upload.
- Site-created historical requests are deduplicated while pending or claimed.
  PostgreSQL workers use `FOR UPDATE SKIP LOCKED`; a 15-minute lease allows a
  disconnected terminal's request to be recovered. The same terminal may retry
  its claimed request while MT5 downloads older bars asynchronously.
- Closed history accepts only MT5 exit/reversal deals. Entry deals are exposed
  through the current open-position snapshot instead of being mislabeled as
  closed trades. Trades use `(account_id, external_id)`.
- Positions use `(account_id, external_id)` and are treated as a complete
  current snapshot. Positions omitted from a later snapshot are removed. The
  EA refreshes profit and swap every `PositionMilliseconds` (500 ms by default).
- Account state is refreshed independently every `AccountMilliseconds`
  (one second by default). Closed history is refreshed after
  `OnTradeTransaction` and retried on transient delivery failures. An empty
  `trades` batch is a valid synchronized state.
- Terminals and accounts use their external identifiers.

The database keeps unique constraints as the final safety boundary. The
application also resolves existing records before a single batch commit so a
retry updates records instead of creating duplicates.

## Connection state

Heartbeat receipt uses backend time, while terminal time is stored separately
for diagnostics. A terminal is considered stale when neither a heartbeat nor a
successful authenticated data upload has been received within
`MT5_HEARTBEAT_TIMEOUT_SECONDS` (90 seconds by default). Data uploads update
`last_sync_at`; heartbeat updates `last_heartbeat_at`.

## Expert Advisor setup

See [`mt5/README.md`](../mt5/README.md). The EA samples changed Bid/Ask and
open-position P&L up to every 500 ms by default, plus completed candles,
account state and exit-deal history. It retries network
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

After updating the EA, compile and reattach or restart it. The terminal polls
for requested ranges every `HistoryRequestSeconds`; `CopyRates` may need several
polls while MetaTrader downloads older broker history. The website waits up to
60 seconds, then visibly falls back to the confirmed continuous cache while the
queued request remains available for a later retry.
