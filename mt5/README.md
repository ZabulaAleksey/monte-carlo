# MetaTrader 5 bridge

`Experts/MonteCarloBridge.mq5` is a read-only Expert Advisor. It sends account,
symbol, live Bid/Ask, closed-candle, open-position and deal-history snapshots
to FastAPI. It
does not import `CTrade` or call `OrderSend`. Its only inbound command is a
request to read and upload an exact candle range; trading actions are impossible.

## Installation

1. Copy repository-root `.env.example` to repository-root `.env`. Replace
   `MT5_API_KEY=...` in that new `.env` file with a random value containing
   at least 32 characters.
2. Copy `mt5/config.example` to `mt5/config.local`. In `config.local`, set
   `BridgeBaseUrl`, a unique `BridgeTerminalId`, and exactly the same
   `MT5_API_KEY` used in the root `.env`. The local file is ignored by Git.
3. Open MetaEditor from MetaTrader 5.
4. Copy `mt5/Experts/MonteCarloBridge.mq5` into
   `MQL5/Experts/MonteCarloBridge/MonteCarloBridge.mq5`.
5. Compile the copied file and attach it to one chart.
6. In MetaTrader, open **Tools → Options → Expert Advisors** and add the exact
   `BridgeBaseUrl` value from `mt5/config.local` to the allowed WebRequest
   URLs.
7. In the EA **Inputs** tab, copy BridgeBaseUrl, BridgeTerminalId, and
   MT5_API_KEY from mt5/config.local. `IncludeAllBrokerQuotes=true` exposes all
   broker instruments, `QuoteMilliseconds=500` controls quote sampling, and
   `PositionMilliseconds=500` controls open-position P&L snapshots.
   `AccountMilliseconds=1000` controls account balance/equity snapshots,
   `TradeRetrySeconds=5` controls closed-deal retry after a trade event, and
   `HistoryRequestSeconds=1` controls historical request polling.

The EA exposes all three values as input parameters in
`mt5/Experts/MonteCarloBridge.mq5`. It deliberately does not read
`config.local`: that ignored file is a private checklist for keeping backend
and terminal values consistent without committing a secret.

The API key is added only to the `X-MT5-API-Key` request header. The EA never
prints request headers, bodies, or the key. Temporary network errors, HTTP 408,
429 and 5xx responses are retried with a short incremental delay.

## Operational notes

- Only completed candles are sent. On first synchronization the bridge requests
  the configured CandleLookbackDays range and uploads it in bounded batches;
  later calls request only candles newer than the last successful batch.
- Changed Bid/Ask observations are sampled every `QuoteMilliseconds` (500 ms by
  default) and uploaded in batches of at most 500 symbols.
- Open positions, including their current price, profit and swap, are uploaded
  every `PositionMilliseconds` (500 ms by default).
- Account balance/equity is uploaded independently every
  `AccountMilliseconds` (one second by default). A trade transaction schedules
  an immediate closed-history refresh, retried every `TradeRetrySeconds` after
  a transient failure.
- The initial Market Watch selection is captured for background candle sync.
  Expanding live quotes to all broker symbols therefore does not trigger a
  ten-year candle backfill for every broker instrument.
- `/strategies` creates an exact From/To request when coverage is incomplete.
  The EA claims it, retries `CopyRates` while MT5 synchronizes history, uploads
  idempotent batches, then completes or fails the request explicitly.
- Initial startup sends a bounded lookback; later calls send new data only.
- Only exit/reversal deals enter closed history; entry deals remain represented
  by the open-position snapshot. Deal and candle batches are safe to resend
  because backend uniqueness keys make the write idempotent.
- An empty positions list is meaningful and clears the stored open-position
  snapshot for that account.
- MetaTrader does not allow `WebRequest` in Strategy Tester. Test the bridge on
  a demo terminal and explicitly allow the backend URL.
- Available depth still depends on the broker history and MetaTrader's
  **Max bars in chart** setting.
