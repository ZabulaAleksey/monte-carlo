# Technical decisions

## 2026-09-08 — `prompts/STAGES.md` владеет execution state

Status: accepted.

### Context

Legacy `docs/AI_PLAN.md` и `docs/AI_STATUS.md` одновременно заявляли current
status/NEXT, а `prompts/STAGES.md` не имел machine-readable selector и содержал
повреждённый encoding. Router не мог безопасно выбрать текущую работу и
возвращал `execution_allowed=false`.

### Decision

`prompts/STAGES.md` является единственным владельцем current Stage ID,
lifecycle/status, blockers, execution evidence и NEXT. `docs/ROADMAP.md`
остаётся производным кратким описанием долгосрочного порядка, AGENTS/README
только маршрутизируют к владельцу, а legacy AI plan/status удаляются после
семантического переноса актуальных фактов и долгов.

### Consequences

- Current stage определяется ровно одной строкой `- Stage ID: <stable-id>` и
  ровно одним heading, содержащим этот ID как отдельный token.
- Исторические launchers могут храниться в `STAGES.md` только как reference без
  собственных selector/status/NEXT.
- Stage 7 остаётся неактивным до завершения reconciliation этапов 3–6 и нового
  прямого разрешения диспетчера.

## ADR-000 — pnpm для frontend и uv для backend

Статус: принято 2026-08-24. Frontend использует `pnpm@11.23.0` и `pnpm-lock.yaml`; backend — uv и `uv.lock`. Общие package caches уменьшают дублирование, а `.venv`/`node_modules` остаются воспроизводимыми локальными projections. Для frontend используется project-local virtual store: Docker переносит `node_modules` между stages, поэтому global virtual links сделали бы образ непереносимым.

Датированный security baseline той же миграции: `pnpm audit` сообщил 11
tooling advisories (1 critical, 5 high, 5 moderate), включая Vitest 2 и
транзитивные Vite/Sharp/PostCSS. Автоматический major/binary upgrade был
отклонён как небезопасная часть dependency migration и оставлен отдельным
security follow-up. Это исторический audit snapshot, а не утверждение о текущем
составе advisories; актуальный security claim требует нового audit lock-графа.

## 2026-09-08 — Один data-reveal clock для replay и ценовой шкалы

Status: accepted for the Stage 6 reliability debt `TD-UI-001`.

### Decision

`TradeReplay` остаётся единственным владельцем data-reveal
`requestAnimationFrame` clock.
Раскрытие новой свечи и необходимое изменение ценовой шкалы выполняются одним
React commit. `CandlestickTradeChart` не запускает независимую scale-анимацию,
но сохраняет SVG, plot layer, ценовую ось и уже показанные свечи смонтированными.
Плавное горизонтальное сопровождение остаётся императивным и меняет React state
только при переходе границы виртуализированного viewport; его отдельный rAF не
является data-reveal или scale-reconciliation clock.

### Reason

Commit `2280b793d74367e6e5ef2572558ea50a4952b62f` добавил второй rAF-loop для
интерполяции шкалы. Один новый экстремум запускал 37 последовательных React
commits в диагностическом сценарии и на каждом из них переписывал геометрию всех
48 уже показанных свечей. SVG и candle nodes не перемонтировались, поэтому
причиной мерцания был не `key`/remount, а повторная полная reconciliation
динамического SVG между соседними replay frames.

### Consequences

- Один replay frame раскрывает не более одной свечи и не создаёт второй
  scale-reconciliation loop.
- Новый экстремум может атомарно изменить вертикальный масштаб один раз; уже
  смонтированные SVG/candle nodes сохраняют identity.
- `smoothFollow`, viewport virtualization, SL/TP, markers и replay speed остаются
  без изменений.
- Production browser acceptance прошёл на всех поддерживаемых скоростях
  `1x, 2x, 4x, 5x, 10x, 20x, 50x, 100x` и границе 20 000 свечей: пустых кадров
  и remount не зарегистрировано, horizontal follow и viewport virtualization
  сохранены. `TD-UI-001` закрыт.

## 2026-08-13 — Изолировать tracing root frontend-приложения

- **Решение:** для Next.js standalone-сборки явно задать
  `outputFileTracingRoot` равным каталогу `apps/frontend`.
- **Причина:** автоматическое определение корня поднималось до workspace из-за
  внешнего `package-lock.json`; Docker при этом не находил `/app/server.js`.
- **Последствие:** standalone-артефакт не зависит от имени и расположения
  репозитория. Внешние runtime-зависимости требуют явного включения в tracing.

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

Replay is the only mode for a newly completed run; there is no separate
animation-enable branch. The same boundary drives the live balance, return,
maximum drawdown and win-rate summary. Replay Stop freezes charts and ledger at
that boundary while summary cards deliberately switch to the persisted
full-range metrics.

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

## 2026-08-22 — Frame-synchronized replay and stable chart layers

Status: accepted for Stage 3; vertical scale interpolation superseded by the
2026-09-08 decision above. Replay pacing, horizontal follow and stable-layer
parts remain active.

### Decision

Animated backtest replay uses one data-reveal `requestAnimationFrame` clock. A
frame may reveal at most one candle, and a delayed browser tab never catches up
through a loop or a multi-candle state update. Speed changes the reveal interval
using `max(1000 / 60, 1667 / speed)` milliseconds.

Horizontal follow keeps pixel offsets outside React state and moves the price
axis through a stable SVG transform. React state changes only when the visible
candle-index range changes. Vertical price bounds formerly used frame timestamps
for time-based interpolation; that part is superseded because it caused repeated
full SVG reconciliation. Price-axis ticks retain stable keys while their values
and positions change. The repeating background grid is rendered by a separate
composited DOM layer underneath a transparent SVG instead of being the SVG
background.

### Reason

Timer callbacks faster than the display refresh can be painted together even
when state increments are individually correct. Storing every scroll pixel in
React state and keying axis ticks by their changing numeric value also causes
unnecessary reconciliation and remounts during animation.

### Consequences

- 100x is bounded by the display refresh and still exposes candles one by one.
- Returning from a suspended tab advances only one candle on the next due frame.
- Existing candle nodes and price-axis tick nodes remain mounted while viewport
  movement progresses; price-scale changes are now atomic.
- Repainting dynamic SVG geometry does not repaint or briefly clear the static
  grid surface below it.
- Full-history width belongs to a lightweight scroll track. The rendered SVG is
  fixed to the visible viewport, and one persistent plot group follows scroll
  position through an imperative transform, avoiding rasterization of a
  potentially hundred-thousand-pixel SVG surface.
- Pause cancels the replay clock; Stop preserves the current rendered frame.

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
