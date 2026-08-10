# MetaTrader 5 bridge

`Experts/MonteCarloBridge.mq5` is a read-only Expert Advisor. It sends account,
symbol, live Bid/Ask, closed-candle, open-position and deal-history snapshots
to FastAPI. It
does not import `CTrade`, call `OrderSend`, or expose any command endpoint.

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
   MT5_API_KEY from mt5/config.local. Keep CandleLookbackDays=3650 to preload
   up to ten years, or reduce it when the terminal stores less history.

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
- Live Bid/Ask observations are sent every `QuoteSeconds` (two seconds by default).
- Initial startup sends a bounded lookback; later calls send new data only.
- Deal and candle batches are safe to resend because backend uniqueness keys
  make the write idempotent.
- An empty positions list is meaningful and clears the stored open-position
  snapshot for that account.
- MetaTrader does not allow `WebRequest` in Strategy Tester. Test the bridge on
  a demo terminal and explicitly allow the backend URL.
- Available depth still depends on the broker history and MetaTrader's
  **Max bars in chart** setting.
