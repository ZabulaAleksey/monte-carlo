# Technical decisions

## 2026-08-10 — Source-confirmed range cache and notional cost units

Status: accepted for Stage 3.

### Decision

Historical completeness is represented by explicit provider-confirmed
intervals, separate from candle rows. PostgreSQL merges overlapping or
timeframe-adjacent intervals and indexes them by symbol, timeframe and bounds.
Both frontend preflight and the engine verify coverage; the engine remains the
authoritative boundary.

Commission and daily swap are percentages of traded/entry notional. Slippage
is a number of quote points, where the point uses at most six decimal digits.

### Reason

Inferring completeness from timestamp gaps produces false failures on weekends,
holidays and instrument-specific sessions. First/last candle checks cannot
prove that a source completed its requested download. Explicit confirmation
preserves that information and makes overlapping ranges reusable.

A percentage without a monetary base is ambiguous. Notional
`price × lots × contract_size` provides a reproducible base across symbols,
while point slippage matches quote precision.

### Consequences

- MT5 confirms a range only after all reported candles exist in the database.
- A failed confirmation rewinds the EA cursor, so the idempotent batch retries.
- Older monetary-cost run JSON remains readable but has no inferred percentage;
  its saved monetary metrics and trades remain unchanged.
- Third-party clients receive the same contracts under `/api/v1/tester`.


## 2026-08-10 — Explicit run isolation and locale-first rendering

Status: accepted for Stage 3.

### Decision

The virtual-trade repository exposes a dedicated run-scoped read operation.
Its SQL query contains an explicit backtest_trades.run_id predicate and ordered
sequence, while a missing run still returns HTTP 404.

The i18n provider does not render application children until the versioned
local-storage locale has been resolved. The first meaningful render therefore
uses the selected catalog, Intl locale and document language.

### Reason

Virtual execution is research evidence and must not rely on a broad
relationship load whose scope is less obvious at the API boundary. Rendering
English before applying a stored language makes localization look broken and
also initializes native date inputs with the wrong language hint.

### Consequences

- A run with zero trades remains distinguishable from a missing run.
- API and UI tests use two runs with different fills to detect cross-run data.
- Storage-restricted browsers fall back to English without breaking the UI.
- A short neutral loading indicator can appear before the localized app.

## 2026-08-10 — One replay clock for chart and virtual execution

Status: accepted for Stage 3.

### Decision

`TradeReplay` owns the animated candle index and supplies one exclusive
`visibleBefore` boundary to both the candlestick chart and the virtual trade
ledger. A trade row appears after its entry is reached; close price, exit
reason, costs and P&L remain hidden until the close is reached.

The same visible trade markers are used for entry/exit symbols, dotted
entry-to-exit connections and exit P&L labels. Period separators are derived
from candle timeframe and UTC timestamps.

### Reason

Keeping separate clocks for chart markers and the ledger would reveal future
trade information and make pause, stop and speed controls inconsistent.

### Alternatives considered

- Keep the complete trade ledger visible during animation. Rejected because it
  leaks future executions.
- Store replay position in the page and distribute it to unrelated panels.
  Rejected because the state belongs to the replay workspace.

### Consequences

- Disabling animation immediately reveals the complete historical result.
- The cutoff is exclusive, so an event on the next candle boundary is not
  visible early.
- Replay-specific chart and ledger behavior is tested together.
