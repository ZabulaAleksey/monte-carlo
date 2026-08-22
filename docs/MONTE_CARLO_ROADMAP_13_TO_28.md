# Monte Carlo / Trading Terminal — исходные 13 этапов и расширение до 28

> Актуальная сводка на 2026-08-22.
> Репозиторий: `ZabulaAleksey/monte-carlo`.

## Где сейчас лежат исходные 13 этапов

Каноническое подробное описание:

- этот файл, `docs/MONTE_CARLO_ROADMAP_13_TO_28.md`;

Короткая дорожная карта и статус:

- `docs/ROADMAP.md`

Поэтапные промпты для будущих этапов лежат в:

- `prompts/03-db-schema.md`
- `prompts/04-fastapi-core.md`
- `prompts/05-ui-baseline.md`
- `prompts/06-backtest-cpu.md`
- `prompts/07-monte-carlo-cpu.md`
- `prompts/08-genetic-reports.md`
- `prompts/09-rabbitmq-workers.md`
- `prompts/09-6-temporal.md`
- `prompts/10-arrow-parquet-duckdb.md`
- `prompts/10-5-hal.md`
- `prompts/11-accelerators.md`
- `prompts/12-cuda-graphs-profiling.md`
- `prompts/13-realtime-ai-future.md`

Этапы 1–2 и все последующие этапы описаны непосредственно в этом документе.
Краткие stage-prompts являются исполняемыми точками входа, но не заменяют
требования этого roadmap, SPEC и фактическую архитектуру.

---

# Часть I. Исходный план — 13 основных этапов

## Этап 1. MVP и базовая архитектура

Основа проекта:

- `apps/frontend`;
- `apps/backend`;
- `infra`;
- `docs`;
- Next.js + React + TypeScript;
- FastAPI;
- PostgreSQL;
- SQLAlchemy 2 + Alembic;
- Docker Compose;
- базовые сущности `symbols`, `candles`, `accounts`, `trades`;
- demo-данные;
- health/API smoke tests.

На этом этапе запрещено преждевременно внедрять стратегии, backtesting, Monte Carlo и GA.

---

## Этап 2. Мост с MetaTrader 5

Read-only интеграция MT5 → backend:

- heartbeat терминала;
- сведения о счёте;
- символы;
- свечи;
- открытые позиции;
- история сделок;
- идемпотентная пакетная запись;
- API-key только через environment;
- MQL5 EA/служебный скрипт;
- отображение `online / cached / demo`;
- frontend не смешивает реальные и demo-данные;
- реальными торговыми приказами backend пока не управляет.

---

## Этап 3. Схема рыночных данных

Расширение существующей PostgreSQL-модели:

- ticks;
- candles;
- market events;
- точность цены;
- timezone;
- source;
- provenance;
- индексы;
- миграции;
- политика хранения;
- TimescaleDB-compatible структура;
- защита от look-ahead / future leakage.

---

## Этап 4. Расширение FastAPI API

Развитие уже существующего backend:

- typed market-data API;
- API стратегий;
- задания;
- результаты;
- фильтрация;
- пагинация;
- идемпотентность;
- структурированные ошибки;
- сохранение слоёв `application / domain / infrastructure`.

---

## Этап 5. Развитие интерфейса терминала

Расширение frontend:

- Dashboard;
- Market;
- Strategies;
- Results;
- Jobs;
- чёткое различение `demo / cached / online`;
- событийные обновления/WebSocket только там, где это оправдано;
- бизнес-логика остаётся вне React-компонентов.

---

## Этап 6. Стратегии и эталонный CPU-backtest

Создание детерминированного доменного движка:

- Strategy API;
- CPU reference implementation;
- фиксируемый dataset;
- версия алгоритма;
- seed;
- commission;
- slippage;
- защита от look-ahead;
- воспроизводимые результаты;
- benchmark до любых GPU-ускорений.

---

## Этап 7. Эталонный Monte Carlo на CPU

Поддерживаемые сценарии:

- permutation порядка сделок;
- bootstrap/resampling;
- изменение slippage;
- изменение commission;
- perturbation параметров;
- моделирование пропущенных сигналов;
- drawdown distribution;
- risk-of-ruin.

Benchmark:

- 10 000 сценариев;
- 100 000 сценариев;
- 1 000 000 сценариев.

Каждый запуск должен иметь детерминированный seed и воспроизводимый provenance.

---

## Этап 8. Генетическая оптимизация и отчёты

Основной pipeline:

```text
GA candidate
    ↓
Backtest
    ↓
Monte Carlo robustness
    ↓
Robust Fitness
    ↓
Next generation
```

Требования:

- границы параметров;
- воспроизводимые population/generation;
- robust fitness вместо максимизации исторического P&L;
- предупреждения об overfitting;
- сохранение экспериментов;
- отчёты с provenance.

---

## Этап 9. RabbitMQ и Celery workers

Тяжёлые вычисления выносятся из FastAPI:

- RabbitMQ — broker;
- Celery/workers — выполнение;
- import jobs;
- backtests;
- Monte Carlo;
- optimization;
- reports;
- retry;
- timeout;
- cancellation;
- status;
- progress;
- идемпотентность.

Redis при необходимости остаётся кэшем/короткоживущим state, но не заменяет broker.

### Дополнительный этап 9.6. Temporal orchestration

Для долгих многошаговых процессов:

```text
import
  ↓
validate
  ↓
backtest
  ↓
Monte Carlo
  ↓
optimize
  ↓
report
```

Temporal отвечает за orchestration/recovery, RabbitMQ/Celery — за выполнение задач.

---

## Этап 10. Arrow, Parquet и DuckDB

Data/analytics layer:

- Apache Arrow — in-memory interchange;
- Parquet — аналитические datasets/results;
- DuckDB — быстрые локальные аналитические запросы;
- меньше сериализаций и копирований;
- dataset version;
- hash;
- provenance.

### Дополнительный этап 10.5. Hardware Abstraction Layer

Единый `ComputeBackend`:

```text
auto
cpu
cuda
opencl
webgpu
vulkan
wasm
```

CPU остаётся эталоном.

Каждый accelerator обязан иметь:

- capability detection;
- fallback;
- equivalence tests;
- benchmark.

---

## Этап 11. ComputeBackend: auto / CPU / CUDA / OpenCL

Полноценные compute adapters:

- runtime capability detection;
- CPU reference;
- CUDA;
- OpenCL;
- автоматический выбор backend;
- безопасный fallback;
- numerical tolerance;
- equivalence testing;
- сохранение backend/device/version в provenance.

---

## Этап 12. Профилирование и CUDA Graphs

Оптимизация только после измерений:

- kernel profiling;
- transfer profiling;
- orchestration overhead;
- end-to-end wall-clock benchmark;
- CUDA Graphs только если overhead действительно значим;
- CPU/CUDA/OpenCL пути сохраняются;
- никакой оптимизации ради самой оптимизации.

---

## Этап 13. Realtime, AI и экспериментальные адаптеры

Только после отдельного согласования:

- realtime layer;
- WebTransport / HTTP/3;
- изолированный LLM-помощник для стратегий/MQL5;
- TEE/confidential-compute research;
- WebGPU;
- Vulkan Compute;
- WASM.

Любая экспериментальная возможность:

- за feature flag;
- имеет fallback;
- имеет tests;
- имеет benchmark;
- не ломает стабильный основной pipeline.

---

# Часть II. Обновлённый план — 28 основных этапов

Этапы 1–13 сохраняются.
Расширение 14–28 добавляет полноценную высокоскоростную data-platform архитектуру, чтобы проект не зависел от постоянно запущенного локального MetaTrader.

Главный приоритет источников:

```text
Broker API
    ↓
MetaApi
    ↓
MT5 Local fallback
    ↓
File import fallback
```

Целевой поток котировок:

```text
Historical API + Live API/WebSocket
                ↓
        Provider Adapter
                ↓
        Rust Ingestion
                ↓
     Hot-memory Ring Buffer
                ↓
          TimescaleDB
                ↓
        Parquet Archive
                ↓
       Arrow / Polars
                ↓
Backtest / Monte Carlo / GA
```

---

## Этапы 1–13

1. MVP и базовая архитектура.
2. Мост с MetaTrader 5.
3. Схема рыночных данных.
4. Расширение FastAPI API.
5. Развитие интерфейса терминала.
6. Стратегии и эталонный CPU-backtest.
7. Эталонный Monte Carlo на CPU.
8. Генетическая оптимизация и отчёты.
9. RabbitMQ и Celery workers.
10. Arrow, Parquet и DuckDB.
11. ComputeBackend auto/cpu/cuda/opencl.
12. Профилирование и CUDA Graphs.
13. Realtime, AI и экспериментальные адаптеры.

Дополнительные подэтапы исходной дорожной карты:

- `9.6` — Temporal orchestration;
- `10.5` — Hardware Abstraction Layer.

---

## Этап 14. Data Provider Contracts & Compatibility Layer

Задача: сначала создать устойчивые контракты, а уже потом подключать конкретные внешние API.

Нужно ввести абстракции примерно такого уровня:

```text
MarketDataProvider
HistoricalDataProvider
LiveMarketDataProvider
TradeProvider
ProviderCapabilities
```

Контракты должны описывать:

- symbols;
- ticks;
- candles;
- trades;
- positions;
- history;
- live stream;
- pagination;
- rate limits;
- reconnect;
- timestamps;
- precision;
- provider-specific metadata.

Обязательное требование: существующий MT5 bridge и текущая бизнес-логика не должны ломаться.

### DoD

- единая provider-модель;
- contract tests;
- compatibility tests;
- старые adapters продолжают работать;
- provider-specific код не протекает в Monte Carlo/Strategy domain.

---

## Этап 15. Provider Registry, Capabilities и Priority Routing

Создать реестр провайдеров и правила выбора источника.

Фиксированный приоритет:

```text
1. Broker API
2. MetaApi
3. MT5 Local
4. File Import
```

Provider Registry должен знать:

- доступность;
- capability;
- latency;
- historical depth;
- live support;
- trades support;
- authentication state;
- health;
- rate-limit state.

Нужны:

- automatic provider selection;
- explicit provider override;
- fallback;
- circuit breaker;
- health checks;
- понятное отображение активного источника в UI.

### DoD

Переключение провайдера не требует изменения domain/Monte-Carlo кода.

---

## Этап 16. Full Historical Bootstrap

Полная первичная загрузка доступной истории без необходимости постоянно запускать MT5.

Поддержать:

- список доступных символов;
- диапазон истории;
- timeframe matrix;
- ticks, если provider их предоставляет;
- candles;
- chunked download;
- pagination;
- resume;
- retry;
- checksum/hash;
- deduplication;
- progress.

Pipeline:

```text
Provider
   ↓
Historical Downloader
   ↓
Validation
   ↓
Normalization
   ↓
Database
```

### DoD

Чистая база может быть автоматически заполнена историей до максимально доступной глубины выбранного provider.

---

## Этап 17. Rust Realtime Ingestion Service

Высокоскоростной live-ingestion вынести в отдельный Rust service.

Он получает:

- ticks;
- quotes;
- candles;
- market events.

Источники:

- broker WebSocket;
- MetaApi stream;
- MT5 fallback.

Основные свойства:

- async I/O;
- bounded queues;
- backpressure;
- reconnect;
- heartbeat;
- sequence tracking;
- low allocation;
- минимальная сериализация.

FastAPI не должен превращаться в hot-path для каждого tick.

### DoD

Realtime data проходит через Rust ingestion независимо от UI и Python API.

---

## Этап 18. Gap Detection, Catch-up и Recovery

Realtime нельзя считать надёжным без обнаружения дыр.

Добавить:

- sequence-number validation;
- timestamp-gap detection;
- reconnect detection;
- startup recovery;
- historical catch-up;
- duplicate suppression;
- out-of-order handling;
- provider reconciliation.

Сценарий:

```text
Live stream interrupted
        ↓
Gap detected
        ↓
Historical API catch-up
        ↓
Deduplicate/reconcile
        ↓
Resume live stream
```

### DoD

После временного отключения система самостоятельно восстанавливает непрерывный dataset.

---

## Этап 19. Batched TimescaleDB Persistence

Не записывать каждый tick отдельной транзакцией.

Нужно реализовать:

- in-memory batches;
- flush by size;
- flush by time;
- bulk/COPY-like inserts;
- TimescaleDB hypertables;
- indexes;
- chunking;
- compression;
- idempotent writes.

Разделить:

```text
ingestion hot path
        ↓
batch buffer
        ↓
TimescaleDB writer
```

### DoD

При росте tick-rate база не становится основным bottleneck.

---

## Этап 20. Hot-Memory Ring Buffer

Последние данные должны быть доступны без постоянного чтения SQL.

Создать bounded ring buffers:

- per symbol;
- per timeframe;
- configurable size;
- lock-minimal/read-optimized access.

Использование:

- realtime chart;
- indicators;
- short-window strategies;
- feature calculations;
- Monte Carlo input preparation.

При переполнении старые элементы автоматически вытесняются.

### DoD

Hot-path не зависит от round-trip в PostgreSQL/TimescaleDB.

---

## Этап 21. Retention Pyramid & Storage Budget

Чтобы база не росла бесконечно, ввести storage lifecycle.

Пример пирамиды:

```text
RAW TICKS
короткое hot-хранение
        ↓
1s / 1m aggregates
среднее хранение
        ↓
5m / 1h / 1d candles
долгое хранение
        ↓
Parquet cold archive
```

Нужно задавать:

- максимальный размер hot DB;
- retention по типу данных;
- retention по timeframe;
- compression policy;
- downsampling;
- archive policy;
- disk-space alerts.

### DoD

Размер основной БД ограничен политикой и предсказуем даже при непрерывном ingestion.

---

## Этап 22. Parquet Cold Archive

Старые данные выводятся из hot database, но не удаляются навсегда.

Добавить:

- partitioned Parquet;
- partition by symbol/date/timeframe;
- compression;
- manifest;
- checksum;
- dataset version;
- provenance;
- restore/re-hydration;
- DuckDB access.

Pipeline:

```text
TimescaleDB
    ↓
Archive job
    ↓
Parquet
    ↓
DuckDB / Analytics / Backtest
```

### DoD

Многолетняя история не обязана постоянно находиться в TimescaleDB.

---

## Этап 23. Arrow / Polars High-Speed Data Plane

Убрать лишние преобразования:

```text
SQL rows
→ Python dict
→ JSON
→ DataFrame
→ NumPy
```

и приблизиться к:

```text
TimescaleDB / Parquet
        ↓
Arrow
        ↓
Polars / NumPy / ComputeBackend
```

Использовать:

- Arrow tables;
- Arrow IPC;
- zero-copy там, где возможно;
- Polars lazy execution;
- predicate pushdown;
- column pruning.

### DoD

Подготовка больших datasets измеримо быстрее и использует меньше памяти.

---

## Этап 24. Broker API Trade Sync

Основной источник реальных торговых данных — API брокера, когда он доступен.

Синхронизировать:

- accounts;
- orders;
- positions;
- fills/deals;
- trade history;
- commissions;
- swaps/fees;
- realized P&L.

Требования:

- read-only сначала;
- external IDs;
- idempotency;
- reconciliation;
- incremental sync;
- full resync;
- provider provenance.

### DoD

Для поддерживаемого брокера MT5 не требуется для импорта сделок и истории.

---

## Этап 25. MetaApi Adapter

MetaApi становится сетевым adapter, когда прямого Broker API нет или его возможностей недостаточно.

Поддержать:

- historical quotes;
- realtime quotes;
- account state;
- positions;
- deals/trades;
- reconnect;
- rate limits;
- provider health.

MetaApi обязан реализовывать те же provider contracts, что и Broker API.

### DoD

Переключение Broker API ↔ MetaApi не меняет Monte Carlo, Strategy и UI domain contracts.

---

## Этап 26. MT5 Local Fallback Adapter

Сохранить локальный MetaTrader как надёжный fallback, а не как обязательный центр системы.

MT5 используется, когда:

- Broker API недоступен;
- MetaApi недоступен;
- нужен специфический broker/terminal data path;
- нужно локальное сравнение/reconciliation.

Нужно:

- использовать существующий bridge;
- привести его к общим provider contracts;
- health/status;
- automatic/manual fallback;
- deduplication;
- provenance.

### DoD

Проект продолжает работать без MT5, но умеет автоматически/явно вернуться к нему.

---

## Этап 27. High-Speed Monte Carlo Data Path

Соединить новую data platform непосредственно с вычислительным контуром.

Целевой путь:

```text
Hot Memory / TimescaleDB / Parquet
                ↓
             Arrow
                ↓
             Polars
                ↓
      ComputeBackend / HAL
                ↓
 CPU / CUDA / OpenCL / ...
                ↓
           Monte Carlo
```

Нужно исключить:

- JSON в compute hot-path;
- ненужные pandas copies;
- повторные SQL-запросы одинаковых datasets;
- повторную нормализацию одного и того же input.

Добавить:

- dataset cache;
- dataset hash;
- immutable simulation input;
- reproducible seeds;
- benchmark 10k / 100k / 1M+ scenarios.

### DoD

Monte Carlo использует новый data plane напрямую и не зависит от конкретного provider.

---

## Этап 28. Reliability, Benchmark & Final Integration

Финальная сборка data-platform части проекта.

Проверить весь путь:

```text
Broker API / MetaApi / MT5
            ↓
Historical + Live
            ↓
Rust Ingestion
            ↓
Gap Recovery
            ↓
Hot Memory
            ↓
TimescaleDB
            ↓
Parquet
            ↓
Arrow / Polars
            ↓
Backtest / Monte Carlo / GA
            ↓
API / UI / Reports
```

Обязательные проверки:

- provider failover;
- network disconnect;
- provider outage;
- restart during ingestion;
- DB restart;
- duplicate events;
- out-of-order events;
- missing intervals;
- disk pressure;
- archive/restore;
- cold start;
- large historical bootstrap;
- sustained live feed;
- Monte Carlo under load.

Benchmark:

- ingestion throughput;
- end-to-end latency;
- DB write throughput;
- memory usage;
- disk growth/day;
- archive rate;
- historical query speed;
- dataset preparation time;
- Monte Carlo scenarios/sec;
- CPU vs CUDA/OpenCL;
- failover/recovery time.

### Финальный DoD

- реальный provider не связан напрямую с бизнес-логикой;
- Broker API — primary;
- MetaApi — secondary;
- MT5 — local fallback;
- File Import — последний fallback;
- непрерывный поток восстанавливается после разрыва;
- база имеет контролируемый размер;
- старая история автоматически архивируется;
- compute path получает данные без лишних сериализаций;
- все fallback-пути покрыты тестами;
- есть reproducible benchmarks;
- старые этапы и завершённые контракты не сломаны.

---

# Итоговая нумерация 1–28

| № | Этап |
|---:|---|
| 1 | MVP и базовая архитектура |
| 2 | Мост с MetaTrader 5 |
| 3 | Схема рыночных данных |
| 4 | Расширение FastAPI API |
| 5 | Развитие интерфейса терминала |
| 6 | Стратегии и эталонный CPU-backtest |
| 7 | Эталонный Monte Carlo на CPU |
| 8 | Генетическая оптимизация и отчёты |
| 9 | RabbitMQ и Celery workers |
| 10 | Arrow, Parquet и DuckDB |
| 11 | ComputeBackend auto/cpu/cuda/opencl |
| 12 | Профилирование и CUDA Graphs |
| 13 | Realtime, AI и экспериментальные адаптеры |
| 14 | Data Provider Contracts & Compatibility Layer |
| 15 | Provider Registry, Capabilities & Priority Routing |
| 16 | Full Historical Bootstrap |
| 17 | Rust Realtime Ingestion Service |
| 18 | Gap Detection, Catch-up & Recovery |
| 19 | Batched TimescaleDB Persistence |
| 20 | Hot-Memory Ring Buffer |
| 21 | Retention Pyramid & Storage Budget |
| 22 | Parquet Cold Archive |
| 23 | Arrow / Polars High-Speed Data Plane |
| 24 | Broker API Trade Sync |
| 25 | MetaApi Adapter |
| 26 | MT5 Local Fallback Adapter |
| 27 | High-Speed Monte Carlo Data Path |
| 28 | Reliability, Benchmark & Final Integration |

---

## Архитектурный принцип расширения 14–28

Новые этапы не должны переписывать завершённые 1–13.

Используем принцип:

```text
existing domain contracts
        ↑
compatibility/adapters
        ↑
new infrastructure
```

То есть новая инфраструктура подключается через adapters/contracts, а не заставляет уже рабочий Monte Carlo, backtesting, Strategy Engine и frontend знать детали конкретного брокера или способа доставки данных.

Также сохраняется правило ДЕВ:

- перед этапом изучить существующую архитектуру;
- не удалять рабочую функциональность;
- не менять завершённые контракты без доказанной необходимости;
- тестировать совместимость;
- иметь fallback;
- измерять производительность до оптимизации;
- не переходить к следующему этапу автоматически.
