# Канонические этапы monte-carlo

Этот файл является единственным владельцем current stage, lifecycle/status,
blockers, execution evidence и NEXT. Подробные продуктовые требования принадлежат
SPEC и `docs/MONTE_CARLO_ROADMAP_13_TO_28.md`; исторические launchers ниже служат
только справочным контекстом.

- Stage ID: MC-RECON-3-6

## MC-RECON-3-6 — Reconciliation канонических этапов 3–6

- Status: in_progress
- NEXT: MC-REM-DB-01
- Blockers: none
- Evidence: 70 atomic requirements classified in `docs/reconciliation/stages-3-6-evidence.md`; totals are 35 VERIFIED, 15 IMPLEMENTED_UNVERIFIED, 8 PARTIAL, 11 MISSING and 1 NOT_APPLICABLE
- Stage 7: NOT ACTIVE; запрещён до завершения reconciliation и отдельного прямого разрешения диспетчера
- TD-UI-001: VERIFIED/CLOSED в `0450e94` и `6f71d1a`; повторно не открывать без нового regression evidence
- TD-BT-001: OPEN; internal engine evidence не заменяет отсутствующую сверку с golden MT5 и блокирует external financial-correctness claim

### Цель

Сопоставить требования канонических этапов 3–6 с фактическими schema/migrations,
API/application boundaries, frontend behavior и accepted tests. Не повышать
статус требования из наличия старого implementation claim без прямого evidence.

### Reconciliation outcome

- Evidence reconciliation этапов 3–6 завершён на уровне каждой atomic row.
- Неразрешённые implementation/evidence gaps сохраняют stage в `in_progress`.
- Dependency-safe queue принадлежит ledger; первый NEXT — `MC-REM-DB-01`.

### Scope NEXT `MC-REM-DB-01`

- зафиксировать bounded contracts tick history и market events;
- определить provenance, retention и Timescale-compatible partition semantics;
- реализовать только после отдельного решения диспетчера;
- не начинать Stage 7 и не использовать его как зависимость remediation.

### Out of scope

- реализация отсутствующей product functionality;
- объявление этапов 3–6 `verified` до завершения evidence matrix и terminal gates;
- подготовка или реализация Stage 7;
- merge, push, deploy и изменение брокерской/MT5 границы.

### Reconciliation guardrails

- каждая строка ledger сохраняет ровно одну классификацию и проверяемую ссылку
  либо точный evidence gap;
- `TD-BT-001` закрыт только при независимом golden-data evidence, иначе остаётся
  `OPEN` с точной областью недоказанного поведения;
- текущий selector не переходит на Stage 7 без отдельного решения диспетчера;
- repository validators и относящиеся к доказательствам checks запущены, а
  ограничения не повышены выше факта.

### Действия пользователя для STAGES location migration

- `USER-MC-STAGES-INTEGRATION` — `DONE`: user authorized merge of the exact
  `feature/docs-stages-canonical` branch after global DEV runtime parity;
  `main` fast-forwarded to `ae92b5d` and pushed. Post-merge backend 63 tests
  and frontend 91 tests PASS; GitHub `main` tree read-back contains
  `docs/STAGES.md` only. Historical launcher guide remains in `docs/notes`,
  selector `MC-RECON-3-6` and product NEXT `MC-REM-DB-01` are unchanged.

## Исторические stage launchers

Секции ниже сохраняют уникальные ограничения прежних prompt-файлов. Они не
являются simultaneous current states и не содержат собственных selector/status/NEXT.

---

## Источник: 03-db-schema.md

# Этап 3 — схема рыночных данных

Выполни этап 3 из `docs/MONTE_CARLO_ROADMAP_13_TO_28.md`.
Сначала проведи evidence-аудит уже существующей схемы, миграций и тестов.
Не дублируй реализованные сущности и не объявляй этап завершённым без проверки
критериев дорожной карты.

---

## Источник: 04-fastapi-core.md

# Этап 4 — расширение FastAPI

Выполни этап 4 из `docs/MONTE_CARLO_ROADMAP_13_TO_28.md`.
Сначала сопоставь существующие routers, application ports, ошибки и тесты с
критериями этапа. Сохрани тонкую HTTP-границу и независимую доменную модель.

---

## Источник: 05-ui-baseline.md

# Этап 5 — интерфейс торгового терминала

Выполни этап 5 из `docs/MONTE_CARLO_ROADMAP_13_TO_28.md`.
Перед изменениями проверь уже реализованные экраны и e2e-контракт. Не смешивай
UI-реализацию с будущими этапами. `TD-UI-001` уже `VERIFIED/CLOSED`; не открывай
его повторно без нового regression evidence.

---

## Источник: 06-backtest-cpu.md

# Этап 6 — стратегии и эталонный CPU-бэктест

Сверь этап 6 из `docs/MONTE_CARLO_ROADMAP_13_TO_28.md` с текущим кодом,
исторически реализованным под названием «Этап 3». Не расширяй функциональность,
пока не закрыты критерии reconciliation gate и `TD-BT-001`.

---

## Источник: 07-monte-carlo-cpu.md

# Этап 7 — эталонный Monte Carlo на CPU

После прямого запроса пользователя и завершения reconciliation gate подготовь
SPEC и выполни этап 7 из `docs/MONTE_CARLO_ROADMAP_13_TO_28.md`.
Зафиксируй deterministic seed, provenance, risk-of-ruin, форматы результатов и
benchmarks 10k/100k/1M. Не переходи к этапу 8 автоматически.

---

## Источник: 08-genetic-reports.md

# Этап 8 — генетическая оптимизация и отчёты

Выполни этап 8 из `docs/MONTE_CARLO_ROADMAP_13_TO_28.md` только после
подтверждённого завершения этапа 7 и прямого запроса пользователя. Сначала
зафиксируй SPEC оптимизации, воспроизводимость и формат отчётов.

---

## Источник: 09-6-temporal.md

# Этап 9.6 — Temporal

Это опциональный подэтап. Выполняй его только по отдельному решению после
основного этапа 9 и согласно разделу 9.6 в
`docs/MONTE_CARLO_ROADMAP_13_TO_28.md`. Сначала докажи необходимость workflow
engine относительно уже работающей очереди.

---

## Источник: 09-rabbitmq-workers.md

# Этап 9 — RabbitMQ и Celery workers

Выполни основной этап 9 из `docs/MONTE_CARLO_ROADMAP_13_TO_28.md` после
проверки профиля нагрузки и границ job contract. Сохрани идемпотентность,
наблюдаемость и возможность локального CPU-выполнения.

---

## Источник: 10-5-hal.md

# Этап 10.5 — HAL

Это опциональный подэтап. Выполняй его только по отдельному решению после
основного этапа 10 и согласно разделу 10.5 в
`docs/MONTE_CARLO_ROADMAP_13_TO_28.md`. Не вводи абстракцию без двух
подтверждённых реализаций или измеримой потребности.

---

## Источник: 10-arrow-parquet-duckdb.md

# Этап 10 — Arrow, Parquet и DuckDB

Выполни этап 10 из `docs/MONTE_CARLO_ROADMAP_13_TO_28.md` после этапа 9.
Зафиксируй схемы, precision, provenance и совместимость с эталонным CPU path.
Не подменяй PostgreSQL без подтверждённой миграционной границы.

---

## Источник: 11-accelerators.md

# Этап 11 — ComputeBackend и ускорители

Выполни этап 11 из `docs/MONTE_CARLO_ROADMAP_13_TO_28.md`.
CPU остаётся эталоном корректности. Зафиксируй capability negotiation,
детерминированность, fallback и сверку результатов каждого backend.

---

## Источник: 12-cuda-graphs-profiling.md

# Этап 12 — profiling и CUDA Graphs

Выполни этап 12 из `docs/MONTE_CARLO_ROADMAP_13_TO_28.md` только на основании
измеренного профиля этапа 11. Сохрани воспроизводимые benchmark fixtures и
корректный CPU fallback.

---

## Источник: 13-realtime-ai-future.md

# Этап 13 — realtime, AI и экспериментальные адаптеры

Выполни этап 13 из `docs/MONTE_CARLO_ROADMAP_13_TO_28.md` после завершения
этапов 1–12 и прямого запроса пользователя. Экспериментальные адаптеры не должны
ослаблять provenance, read-only границу и эталонный CPU-контракт.
