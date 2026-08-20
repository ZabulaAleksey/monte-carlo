# Technical decisions

## 2026-08-10 — Durable history queue and route-scoped tick snapshots

Status: accepted for Stage 3.

### Decision

Incomplete coverage creates a durable `historical_data_requests` job instead
of hoping that the EA's periodic lookback eventually reaches the selected
dates. An authenticated terminal atomically claims the oldest eligible job,
uploads idempotent candle batches and explicitly completes or fails it.

The EA exposes all broker symbols and sends only changed latest quotes in
bounded batches. PostgreSQL keeps one quote snapshot per symbol; the frontend
polls that snapshot every 500 ms only while `/market-data` or Dashboard is
mounted. Dashboard performs quote-only refreshes instead of reloading its full
snapshot.

### Reason

From/To is user intent and must reach the data source. A durable queue survives
browser refreshes and disconnected terminals, while `SKIP LOCKED`, an active
partial unique index and a lease make claims safe for multiple terminals.
Persisting every raw tick would create unbounded storage and write pressure
before tick-history use cases are defined.

### Alternatives considered

- Increase the periodic candle lookback for every symbol. Rejected because it
  still cannot express an exact requested range and repeats expensive reads.
- Poll quotes globally from the layout. Rejected because every URL would create
  high-frequency traffic even when no quote board is visible.
- Store every tick immediately. Deferred in favor of a partitioned time-series
  design if tick replay or audit becomes a concrete requirement.

### Consequences

- Schema revision `0009` is required before the new endpoints are used.
- The UI waits up to 60 seconds, then visibly uses confirmed partial data while
  the durable request remains available to MT5.
- Leaving Market Data or Dashboard clears its 500 ms timer. Dashboard keeps a
  separate 15-second refresh only for heavier reference/account data.
- Fast quotes show the latest sampled state, not a complete tick archive.

## 2026-08-10 — Explicit partial-data fallback and read-only operations UI

Status: accepted for Stage 3.

### Decision

Strict tester requests continue to require complete provider-confirmed
coverage. Interactive and external clients may explicitly set
`allow_partial_data=true`; the application then selects the largest confirmed
continuous overlap and persists both requested and actual ranges with a data
quality flag and warnings.

The website's PostgreSQL section is deliberately read-only. It exposes only
aggregate table counts, server/schema metadata and candle-cache ranges through
a typed application service. API documentation is downloadable as a static
Markdown artifact and from the backend.

### Reason

A missing part of a long historical request should be visible evidence, not a
generic connection failure or a silent range change. Choosing one confirmed
continuous interval avoids simulating across unknown holes. Arbitrary SQL and
browser-visible credentials would make an operational convenience a security
boundary violation.

### Consequences

- Partial results are reproducible and visibly distinguishable from complete
  runs.
- The UI briefly polls coverage, then proceeds with available confirmed data.
- PostgreSQL changes still require migrations or backend code review.
- A standalone offline guide remains usable when no container can serve HTTP.

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

## 2026-08-20 — Состояние MT5 определяется по фактической активности

Status: accepted for Stage 3.

### Decision

Соединение считается активным, если в пределах timeout получен heartbeat или
успешный аутентифицированный пакет данных. Dashboard выбирает счёт по
`account_external_id` активного терминала. Account и closed trades имеют
отдельный короткий цикл обновления, независимый от минутной полной
синхронизации EA.

### Reason

Котировки уже доказывают, что терминал и WebRequest работают. Требование только
свежего heartbeat создавало противоречивый статус «не подключён» при живом
рынке, а минутный snapshot задерживал баланс и торговые метрики.

### Consequences

- Любой успешный защищённый MT5 upload поддерживает online-статус.
- Пустой batch сделок является корректным состоянием «закрытых сделок нет».
- Dashboard обновляет account/trades каждые две секунды только пока открыт.
