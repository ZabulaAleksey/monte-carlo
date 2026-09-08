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
