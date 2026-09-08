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
