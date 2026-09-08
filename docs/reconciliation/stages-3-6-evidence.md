# Evidence reconciliation: canonical stages 3–6

Этот ledger фиксирует factual evidence для selected stage `MC-RECON-3-6`.
Requirements принадлежат `docs/MONTE_CARLO_ROADMAP_13_TO_28.md` и SPEC; этот
файл не является вторым владельцем current Stage ID/status/NEXT.

## Правила классификации

Приоритет evidence: executable tests → reachable production code/schema →
runtime/browser/API/database evidence → current SPEC/ADR/architecture →
historical context. Допустимы только `VERIFIED`, `IMPLEMENTED_UNVERIFIED`,
`PARTIAL`, `MISSING`, `NOT_APPLICABLE`. Наличие файла, старый status или unit
test не заменяют явно требуемое DB/browser/external golden evidence.

## Stage 3 — схема рыночных данных

Canonical source: раздел «Этап 3. Схема рыночных данных» в roadmap.

| ID | Requirement | Subsystem | Implementation evidence | Test/runtime evidence | Class | Exact gap / dependency | Remediation slice | Before Stage 7 |
|---|---|---|---|---|---|---|---|---|
| MC3-R01 | Хранить ticks | PostgreSQL market data | `MarketQuoteModel` хранит только последний snapshot на символ; raw-tick entity/table отсутствует | `test_mt5_bridge.py` проверяет quote ingestion, но не tick history | MISSING | Нет tick schema, lifecycle и retention; сначала требуется bounded tick-history contract | `MC-REM-DB-01` | yes |
| MC3-R02 | Хранить candles | PostgreSQL market data | `CandleModel`, migration `0001`, unique `(symbol_id,timeframe,open_time)`, cascade FK | `test_trading_data.py`, `test_mt5_bridge.py` PASS на SQLite API path | IMPLEMENTED_UNVERIFIED | Нет current PostgreSQL `alembic upgrade head`/schema inspection evidence | `MC-REM-DB-02` | yes |
| MC3-R03 | Хранить market events | PostgreSQL market data | Generic market-event entity/table отсутствует | Tests отсутствуют | MISSING | Не определены event taxonomy, payload/version и retention | `MC-REM-DB-01` | yes |
| MC3-R04 | Явная точность цены | Schema/API | `Numeric(24,8)` для OHLC/quotes и `symbols.digits` | Decimal-string API assertions существуют; PostgreSQL precision не проверена runtime | IMPLEMENTED_UNVERIFIED | Нужен PostgreSQL schema/round-trip boundary test для заявленной точности | `MC-REM-DB-02` | yes |
| MC3-R05 | Явный timezone | Schema/API | `DateTime(timezone=True)`; API требует offset и нормализует UTC | timezone/future validation покрыта MT5/API tests; DB runtime не проверен | IMPLEMENTED_UNVERIFIED | Нет PostgreSQL timezone round-trip/migration evidence | `MC-REM-DB-02` | yes |
| MC3-R06 | Явный source | Domain/schema | Candle/coverage/quote `source`; `CandleSource` различает `demo`, `mt5`, `api` | API/MT5 tests подтверждают source filtering и promotion | VERIFIED | — | — | yes |
| MC3-R07 | Хранить provenance | Data lineage | Есть source, requested/actual ranges, coverage source и data-complete warnings | Internal tests проверяют ranges/coverage | PARTIAL | Нет dataset/version/hash/transformation lineage для ticks/events/candles | `MC-REM-DB-01` | yes |
| MC3-R08 | Индексы под доступ | Schema | Candle, quote, coverage, request, trade и backtest indexes объявлены в models/migrations | `alembic heads` → `0009`; PostgreSQL index materialization/query plan не проверены | IMPLEMENTED_UNVERIFIED | Нет real PostgreSQL apply/introspection; отсутствующие tick/event tables не индексированы | `MC-REM-DB-02` | yes |
| MC3-R09 | Последовательные миграции | Alembic | Linear chain `0001`…`0009`, upgrade/downgrade code присутствует | `alembic heads` → single `0009`; apply/rollback не выполнялся на PostgreSQL | IMPLEMENTED_UNVERIFIED | Нужен clean PostgreSQL upgrade и schema assertions | `MC-REM-DB-02` | yes |
| MC3-R10 | Политика хранения | Data lifecycle | Для raw history retention owner/job/config отсутствует | Tests отсутствуют | MISSING | Нужны retention requirements для ticks/events и explicit no-loss boundary для candles/runs | `MC-REM-DB-01` | yes |
| MC3-R11 | TimescaleDB-compatible структура | PostgreSQL/TimescaleDB | Relational timestamp/range layout не использует запрещающие Timescale types | Нет hypertable/Timescale migration или compatibility run; ticks/events отсутствуют | PARTIAL | Совместимость не доказана и целевая hypertable/partition key policy не определена | `MC-REM-DB-01` | yes |
| MC3-R12 | Защита от look-ahead/future leakage | Domain/query boundary | Provider сортирует диапазон; `CandleHistory` даёт read-only prefix; future MT5 timestamps отклоняются | `test_strategy_never_receives_future_candles` и MT5 invalid/future tests PASS | VERIFIED | — | — | yes |

### Stage 3 evidence run

- `uv run --offline python -m pytest tests/test_trading_data.py tests/test_mt5_bridge.py tests/test_historical_data_requests.py tests/test_backtest_engine.py::test_strategy_never_receives_future_candles -q` — `16 passed`.
- `uv run --offline alembic heads` — single head `0009`.
- Environment used a project-scoped external uv cache because the shared AppData
  cache returned `Access denied`; no product files were changed by the workaround.

### Stage 3 totals

| VERIFIED | IMPLEMENTED_UNVERIFIED | PARTIAL | MISSING | NOT_APPLICABLE |
|---:|---:|---:|---:|---:|
| 2 | 5 | 2 | 3 | 0 |

## Stage 4 — расширение FastAPI API

Canonical source: раздел «Этап 4. Расширение FastAPI API» в roadmap; security
и retry rows уточняют прямо требуемые этой reconciliation границы.

| ID | Requirement | Subsystem | Implementation evidence | Test/runtime evidence | Class | Exact gap / dependency | Remediation slice | Before Stage 7 |
|---|---|---|---|---|---|---|---|---|
| MC4-R01 | Typed market-data API | FastAPI/schema | Typed symbol/candle/quote/account/position/trade schemas and routes | HTTP create/list/filter/source tests PASS | VERIFIED | — | — | yes |
| MC4-R02 | API стратегий | FastAPI/backtest application | `GET /api/v1/tester/backtests/strategies` maps domain definitions | `test_backtests_api.py` exercises route and response | VERIFIED | — | — | yes |
| MC4-R03 | API заданий | Jobs/application | create/status/pause/resume/stop endpoints and `BacktestJobManager` | API/job lifecycle tests PASS | VERIFIED | — | — | yes |
| MC4-R04 | API результатов | FastAPI/persistence | create/list/get/delete run and run-scoped trades under stable tester namespace | API tests persist, retrieve, isolate and delete runs | VERIFIED | — | — | yes |
| MC4-R05 | Фильтрация | Query/application ports | Candles filter by symbol/timeframe/time range/source; quotes by symbol; positions/trades by account; run listing only has a limit | HTTP tests cover the implemented filters | PARTIAL | There is no systematic filtering contract across runs/results/jobs; supported filters are endpoint-specific | `MC-REM-API-01` | yes |
| MC4-R06 | Пагинация | Public API | List endpoints expose bounded `limit` values only | No cursor/offset/page metadata tests | MISSING | `limit` alone is not pagination; define stable ordering and continuation contract | `MC-REM-API-01` | yes |
| MC4-R07 | Идемпотентность | Mutating APIs | Candle/MT5 upserts and active historical requests deduplicate; DB uniqueness backs selected paths | Duplicate MT5 batches and history requests PASS | PARTIAL | Backtest/job creation and general public mutations have no idempotency-key/replay contract | `MC-REM-API-02` | yes |
| MC4-R08 | Структурированные ошибки | API boundary | Central handlers return `{error:{code,message,request_id,details?}}` | validation/domain/auth error tests PASS | VERIFIED | — | — | yes |
| MC4-R09 | Сохранить application/domain/infrastructure layers | Backend architecture | Routes inject application services; domain backtest package has no FastAPI/ORM/MT5 imports; repositories implement ports | API/domain suites exercise reachable layered path | VERIFIED | — | — | yes |
| MC4-R10 | Auth/security boundary where applicable | MT5 API | All `/api/v1/mt5/*` ingestion/history operations require configured `X-MT5-API-Key`; product remains read-only toward broker | Missing/wrong key and authorized calls tested | VERIFIED | — | — | yes |
| MC4-R11 | Retry/lease behavior where required | Historical data/MT5 | Durable requests have pending/claimed/completed/failed lifecycle, lease expiry and bounded MQL `CopyRates` retries | API lifecycle and source assertions PASS | PARTIAL | No live terminal/reconnect/lease-expiry integration evidence | `MC-REM-API-03` | yes |

### Stage 4 evidence run

- `uv run --offline python -m pytest tests/test_trading_data.py tests/test_backtests_api.py tests/test_backtest_jobs.py tests/test_historical_data_requests.py tests/test_mt5_bridge.py tests/test_mt5_status.py tests/test_service_api.py tests/test_errors.py -q` — `29 passed`.
- Tests invoke the ASGI application through HTTPX and therefore prove route →
  schema → dependency → application/repository behavior in the test database;
  they do not prove external MT5 reconnect or PostgreSQL deployment behavior.

### Stage 4 totals

| VERIFIED | IMPLEMENTED_UNVERIFIED | PARTIAL | MISSING | NOT_APPLICABLE |
|---:|---:|---:|---:|---:|
| 7 | 0 | 3 | 1 | 0 |

## Stage 5 — развитие интерфейса терминала

Canonical source: раздел «Этап 5. Развитие интерфейса терминала» в roadmap;
rows MC5-R09–R13 атомизируют обязательные UI evidence surfaces из Slice B.

| ID | Requirement | Subsystem | Implementation evidence | Test/runtime evidence | Class | Exact gap / dependency | Remediation slice | Before Stage 7 |
|---|---|---|---|---|---|---|---|---|
| MC5-R01 | Dashboard | `/` frontend | Dashboard screen composes portfolio, pulse, chart, trades and MT5 status from feature models | Dashboard/model/component tests PASS | IMPLEMENTED_UNVERIFIED | No current production-browser baseline acceptance for loading/error/empty/live data | `MC-REM-UI-01` | yes |
| MC5-R02 | Market | `/market-data` | Market screen renders quotes/candles, sorting and source states | Market component/model and live-quote hook tests PASS | IMPLEMENTED_UNVERIFIED | No current real-browser/live-refresh acceptance | `MC-REM-UI-01` | yes |
| MC5-R03 | Strategies | `/strategies` | Workbench provides form, run lifecycle, saved research and replay | Component suite PASS; production Chrome replay acceptance at 1x–100x/20 000 candles is current at `6f71d1a` | VERIFIED | — | — | yes |
| MC5-R04 | Results | Strategies result workspace | Persisted runs, metrics, equity, execution map and ledger are reachable after run/select | Component and backend API integration tests PASS | IMPLEMENTED_UNVERIFIED | No broad production-browser result-view acceptance beyond replay invariant | `MC-REM-UI-01` | yes |
| MC5-R05 | Jobs | Strategies job controls | queued/loading/simulating/paused/stopped/completed/failed states and controls exist | Job API plus Strategies fake-timer/component tests PASS | IMPLEMENTED_UNVERIFIED | No real backend/browser pause/resume/stop acceptance | `MC-REM-UI-01` | yes |
| MC5-R06 | Чётко различать demo/cached/online | Data environment/UI | Source filtering, environment model, badges and connection states prevent demo/MT5 mixing | data-environment, Dashboard, Market, Trades and navigation tests PASS | VERIFIED | — | — | yes |
| MC5-R07 | Event/WebSocket only where justified | Transport architecture | Current latest-snapshot contract uses route-scoped bounded polling; no server-push requirement is present | Poll cleanup/visibility tests and ADR explain the choice | NOT_APPLICABLE | WebSocket is deliberately inapplicable until a concrete streaming requirement exists | — | no |
| MC5-R08 | Business logic outside React components | Frontend architecture | Route files compose feature screens; data environment, formatting, sorting and ViewModels are pure modules; shared hooks own polling | Pure model/hook tests plus page tests PASS | VERIFIED | — | — | yes |
| MC5-R09 | Loading/error/empty states | Shared/UI states | Shared components and per-screen empty/loading/error branches exist | jsdom component assertions PASS | IMPLEMENTED_UNVERIFIED | Visual/accessibility behavior is not accepted in a production browser across core routes | `MC-REM-UI-01` | yes |
| MC5-R10 | Terminal layout and responsive behavior | CSS/layout | Persistent navigation, panels, grids and breakpoints at 1050/720 px exist | Static CSS and component structure inspected | IMPLEMENTED_UNVERIFIED | No viewport matrix/browser screenshots or keyboard/touch acceptance for baseline routes | `MC-REM-UI-01` | yes |
| MC5-R11 | Account/trade presentation | Dashboard/Trades | Account-bound portfolio, open positions and closed net-P&L presentation exist | Dashboard/Trades model and page tests plus API tests PASS | IMPLEMENTED_UNVERIFIED | No current live-browser account/trade presentation acceptance | `MC-REM-UI-01` | yes |
| MC5-R12 | Localization required by current UI | i18n | EN/RU/UA/BE catalogs, locale-first bootstrap, document language and localized date controls exist | i18n/navigation/calendar/title tests PASS | IMPLEMENTED_UNVERIFIED | No production-browser sweep for all locales and responsive overflow | `MC-REM-UI-01` | yes |
| MC5-R13 | Realtime refresh lifecycle | Polling/hooks | Quotes 500 ms route-local; account/trade and heavier snapshots use bounded cadences with overlap/visibility/unmount guards | hook/page fake-timer tests PASS | IMPLEMENTED_UNVERIFIED | No live backend/browser cadence, reconnect and navigation-cleanup trace | `MC-REM-UI-01` | yes |

`TD-UI-001` is not reclassified here. Its independent regression invariant and
production-browser evidence remain `VERIFIED/CLOSED`; it does not substitute
for the broader Stage 5 browser baseline gaps above.

### Stage 5 evidence run

- `node_modules/.bin/vitest.cmd run` — `23 test files, 91 tests passed`.
- The direct runner required execution outside the filesystem sandbox because
  esbuild config discovery received `Access denied` while reading an ancestor
  path. `pnpm test` itself could not open the shared pnpm store database. No
  lockfile, dependency or product code was changed.
- Existing production Chrome evidence at commit `6f71d1a` applies only to the
  real Strategies replay path and the closed candle-flicker invariant.

### Stage 5 totals

| VERIFIED | IMPLEMENTED_UNVERIFIED | PARTIAL | MISSING | NOT_APPLICABLE |
|---:|---:|---:|---:|---:|
| 3 | 9 | 0 | 0 | 1 |

## Stage 6 — стратегии и эталонный CPU-backtest

Canonical source: раздел «Этап 6. Стратегии и эталонный CPU-backtest» в
roadmap и системные инварианты SPEC. Rows MC6-R11–R34 атомизируют обязательные
engine и `TD-BT-001` surfaces из Slice B. `VERIFIED` для внутренних денежных
rows означает только доказанную текущую формулу движка; external MT5
financial correctness отдельно оценивается MC6-R30–R34.

| ID | Requirement | Subsystem | Implementation evidence | Test/runtime evidence | Class | Exact gap / dependency | Remediation slice | Before Stage 7 |
|---|---|---|---|---|---|---|---|---|
| MC6-R01 | Strategy API | Domain/API | Framework-independent `Strategy` protocol, catalog and typed tester route | Strategy catalog/API tests PASS | VERIFIED | — | — | yes |
| MC6-R02 | CPU reference implementation | Domain engine | Decimal-based `BacktestEngine`, execution/risk/position/metrics collaborators | Engine suite executes the reachable CPU path | VERIFIED | External financial equivalence is deliberately assessed in MC6-R30–R34 | — | yes |
| MC6-R03 | Фиксируемый dataset | Data provenance | Result persists symbol, timeframe, requested/actual range and candle count | API persistence assertions PASS | PARTIAL | Dataset content hash/version and immutable transformation identity are absent | `MC-REM-BT-01` | yes |
| MC6-R04 | Версия алгоритма | Provenance | `strategy_version` is persisted and returned | Persistence/API tests PASS | PARTIAL | Engine/calculation version is not captured | `MC-REM-BT-01` | yes |
| MC6-R05 | Seed | Reproducibility | No seed field exists in request, result or persisted run | Search of backend/frontend contracts finds no seed implementation | MISSING | Explicit roadmap/SPEC provenance input is absent even though the current engine is non-random | `MC-REM-BT-01` | yes |
| MC6-R06 | Internal commission semantics | Execution model | Entry and exit percentage-of-notional fills use Decimal and contract size | `test_commission_is_charged_on_entry_and_exit` PASS | VERIFIED | Not an MT5 commission-schedule equivalence claim | `MC-REM-BT-04` | yes |
| MC6-R07 | Internal slippage semantics | Execution model | Signed quote-point adjustment with six-digit cap | Both slippage tests PASS | VERIFIED | Not an MT5 execution-quality equivalence claim | `MC-REM-BT-04` | yes |
| MC6-R08 | Защита от look-ahead | Engine/history | Strategy receives a read-only history prefix and signal executes at next candle open | Future-history test and next-open execution test PASS | VERIFIED | — | — | yes |
| MC6-R09 | Internal reproducibility | Engine | Same ordered candles/settings/strategy follow a deterministic Decimal path | `test_remaining_position_is_closed_and_result_is_reproducible` PASS | VERIFIED | Complete provenance envelope remains partial in MC6-R03–R05 | `MC-REM-BT-01` | yes |
| MC6-R10 | Benchmark до GPU | Performance evidence | No Stage 6 CPU benchmark harness/result is present | Repository search finds only benchmark requirements | MISSING | Need versioned workload, environment and baseline after correctness contract is fixed | `MC-REM-BT-05` | yes |
| MC6-R11 | Position lifecycle | Domain/execution | Single-position manager handles open, hold, close, reverse and end-of-data close | Lifecycle/end-of-data tests PASS | VERIFIED | — | — | yes |
| MC6-R12 | BUY semantics | Domain/execution | BUY opens a long position through the order simulator | next-open, P&L and risk tests exercise BUY | VERIFIED | — | — | yes |
| MC6-R13 | SELL semantics | Domain/execution | SELL maps to short side, reverse handling and signed P&L code paths | No focused short-position lifecycle/P&L/protective-exit test exists | IMPLEMENTED_UNVERIFIED | Add test-only deterministic short scenarios before relying on SELL parity | `MC-REM-BT-02` | yes |
| MC6-R14 | Signal exit | Domain/execution | `Signal.CLOSE` closes at next candle open with `ExitReason.SIGNAL` | focused signal-close test PASS | VERIFIED | — | — | yes |
| MC6-R15 | Stop Loss | Risk/execution | Side-aware level calculation; stop-first intrabar policy is explicit | focused long Stop Loss test PASS | VERIFIED | Short-side proof is coupled to MC6-R13 | `MC-REM-BT-02` | yes |
| MC6-R16 | Take Profit | Risk/execution | Side-aware level calculation and intrabar trigger | focused long Take Profit test PASS | VERIFIED | Short-side proof is coupled to MC6-R13 | `MC-REM-BT-02` | yes |
| MC6-R17 | Internal swap semantics | Execution model | Signed daily percentage of entry notional for crossed days | negative and positive swap tests PASS | VERIFIED | No historical MT5 rollover schedule or triple-rollover equivalence | `MC-REM-BT-04` | yes |
| MC6-R18 | Bankruptcy | Engine | Non-positive equity forces close and stops future strategy calls | focused bankruptcy test PASS | VERIFIED | — | — | yes |
| MC6-R19 | Balance | Engine/metrics | Entry commission, close proceeds and final balance are updated deterministically | commission, P&L, bankruptcy and persistence assertions PASS | VERIFIED | MT5 monetary parity remains outside this row | `MC-REM-BT-04` | yes |
| MC6-R20 | Liquidation/current equity | Engine/curve | Open P&L and accrued swap feed per-candle current equity; bankruptcy liquidates | unrealized drawdown and bankruptcy tests PASS | VERIFIED | MT5 monetary parity remains outside this row | `MC-REM-BT-04` | yes |
| MC6-R21 | Internal realized P&L | Execution/metrics | Closed-trade gross/net profit and aggregate net profit are persisted | contract-size, commission and API persistence tests PASS | VERIFIED | Tick-value/currency conversion and golden parity absent in MC6-R30–R34 | `MC-REM-BT-03`, `MC-REM-BT-04` | yes |
| MC6-R22 | Internal unrealized P&L | Execution/equity | Side-aware mark-to-close formula feeds equity curve | unrealized loss/equity test PASS | VERIFIED | Tick-value/currency conversion and golden parity absent in MC6-R30–R34 | `MC-REM-BT-03`, `MC-REM-BT-04` | yes |
| MC6-R23 | Maximum drawdown | Metrics | Max of the stored per-point balance-to-equity gaps and percentages | focused max-drawdown test PASS | VERIFIED | MT5 report-definition parity is not established | `MC-REM-BT-04` | yes |
| MC6-R24 | Absolute drawdown | Metrics | Per-point absolute balance/equity gap and maximum absolute gap are exposed | focused unrealized/max-drawdown assertions PASS | VERIFIED | MT5 report-definition parity is not established | `MC-REM-BT-04` | yes |
| MC6-R25 | Lot volume | API/application | Requested lot is checked against symbol min/step/max and platform cap | min/step/cap API and engine tests PASS | VERIFIED | — | — | yes |
| MC6-R26 | Contract size | Symbol/application/execution | Positive symbol contract size is persisted and injected into P&L/cost models | focused 0.1-lot × 100000 contract-size test PASS | VERIFIED | Instruments needing tick-value conversion remain unproven | `MC-REM-BT-03` | yes |
| MC6-R27 | Persistence | PostgreSQL repository | Runs, trades, complete equity curve, settings, parameters, ranges and metrics have models/migrations | API persistence/retrieval/delete tests PASS on SQLite | VERIFIED | PostgreSQL apply evidence remains MC3-R09/`MC-REM-DB-02` | `MC-REM-DB-02` | yes |
| MC6-R28 | API and replay | Backend/frontend | Typed create/list/get/delete/jobs API and persisted-result replay are reachable | API tests PASS; Strategies replay has production Chrome evidence at `6f71d1a` | VERIFIED | — | — | yes |
| MC6-R29 | Deterministic fixtures | Test/provenance | Synthetic candle/strategy fixtures cover internal formulas | Internal fixtures are deterministic and tests PASS | PARTIAL | No immutable, provenance-recorded MT5 input/output fixture exists | `MC-REM-BT-04` | yes |
| MC6-R30 | Tick size | Symbol/financial contract | Symbol exposes digits, not MT5 trade tick size | No contract or test found | MISSING | `SYMBOL_TRADE_TICK_SIZE` is absent | `MC-REM-BT-03` | yes |
| MC6-R31 | Tick value | Symbol/financial contract | P&L uses price delta × lots × contract size only | No tick-value contract or test found | MISSING | MT5 tick-value semantics are absent | `MC-REM-BT-03` | yes |
| MC6-R32 | Profit currency | Symbol/financial contract | Symbol has no profit-currency field | No currency fixture or test found | MISSING | Cannot state the denomination of calculated P&L | `MC-REM-BT-03` | yes |
| MC6-R33 | Account-currency conversion | Financial engine | Account model has currency, but engine does not receive or convert through rates | No conversion port/rate/provenance test found | MISSING | Cross-currency P&L is outside the implemented boundary | `MC-REM-BT-03` | yes |
| MC6-R34 | MT5 golden provenance, coverage and tolerance | External reference | No golden trades/export parser/provenance manifest/tolerance comparator exists | No BUY/SELL/cost/exit/P&L/drawdown golden test found | MISSING | `TD-BT-001` remains OPEN; reference values must come from a real captured MT5 dataset | `MC-REM-BT-04` | yes |

### Stage 6 evidence run

- `uv run --offline python -m pytest tests/test_backtest_engine.py tests/test_backtests_api.py tests/test_backtest_jobs.py -q` — `31 passed`.
- The suite proves current internal CPU formulas and reachable API persistence on
  the SQLite test repository. It does not prove PostgreSQL deployment or MT5
  financial equivalence.
- Repository search found no `tick_size`, `tick_value`, profit-currency,
  account-currency conversion, MT5 golden fixture/tolerance, seed,
  dataset hash, engine version or executable benchmark contract.

### TD-BT-001 evidence boundary

Internal BUY execution, lot/contract-size arithmetic, commission, swap,
slippage, signal exit, long-side SL/TP, bankruptcy, balance/equity,
realized/unrealized P&L and drawdown have deterministic tests. SELL is
implemented but lacks a focused short lifecycle/financial test. None of these
tests compare against an independently sourced MT5 result. Tick size/value,
profit currency and account-currency conversion are absent, and no golden
fixture provenance or tolerance is defined. Therefore `TD-BT-001` remains
`OPEN` and no external financial-correctness claim is made.

### Stage 6 totals

| VERIFIED | IMPLEMENTED_UNVERIFIED | PARTIAL | MISSING | NOT_APPLICABLE |
|---:|---:|---:|---:|---:|
| 23 | 1 | 3 | 7 | 0 |
