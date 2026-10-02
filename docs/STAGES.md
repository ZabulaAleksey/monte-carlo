# Канонические этапы monte-carlo

Этот файл является единственным владельцем current stage, lifecycle/status,
blockers, execution evidence и NEXT. Подробные продуктовые требования принадлежат
SPEC и `docs/MONTE_CARLO_ROADMAP_13_TO_28.md`; исторические launchers ниже служат
только справочным контекстом.

- Stage ID: MC-RECON-3-6

## MC-RECON-3-6 — Reconciliation канонических этапов 3–6

- Status: in_progress
- NEXT: MC-REM-DB-01
- Night frontend compatibility 2026-10-02: MC-BUILD-001 LOCALLY_VERIFIED; pnpm11/Node20 incompatibility reproduced and repaired with pinned Node22.23.3 image. Frozen Linux build and standalone runtime PASS; frontend91 PASS, lint PASS. Independent ledger MC-REM-BT-02 is now internally VERIFIED by 10 SELL scenarios; D1–D4 remains NEEDS_DECISION. Overall MC-RECON-3-6 remains in_progress; no Stage7 activation.
- Night recheck 2026-10-01: locked backend restore + 72 tests PASS/1 guarded PostgreSQL skip, Ruff/mypy55 PASS; frontend 91 tests PASS with maxWorkers=1, lint PASS. Full Windows standalone build ENVIRONMENT_BLOCKED by symlink EPERM after successful compile/type/static11 pages. Evidence: docs/notes/night-reproducibility-2026-10-01.md; no fresh DB claim.
- Blockers: MC-DB01-DECISION-01 — неопределённые tick consumer, market-event taxonomy, retention budget и Timescale rollout; миграция и запись данных ожидают утверждённый контракт
- Evidence: 70 atomic requirements classified in `docs/reconciliation/stages-3-6-evidence.md`; totals are 40 VERIFIED, 9 IMPLEMENTED_UNVERIFIED, 9 PARTIAL, 11 MISSING and 1 NOT_APPLICABLE after the independent existing-schema PostgreSQL proof below.
- NIGHT RUN V2 execution-order divergence: the existing-schema portion of `MC-REM-DB-02` does not depend on selecting tick/event consumers or retention. Disposable PostgreSQL 17.6 clean upgrade 0001→0009, `alembic check`, 0009→0008→0009 rehearsal and guarded numeric/UTC/constraint/index round-trip PASS; full backend 64 PASS, Ruff/mypy PASS. No tick/event migration, automatic retention, live MT5 or PostgreSQL backtest repository claim follows. `MC-REM-DB-01` remains the active NEXT for the bounded storage contract.
- Backend dependency security checkpoint 2026-09-30: `uv audit --locked` found two advisory records for pytest 8.4.2 tmpdir handling. Updated only pytest 9.1.1 and its incompatible pytest-asyncio companion to 1.4.0. Locked restore, 63 backend tests PASS/1 guarded PostgreSQL skip, Ruff/mypy PASS, repeated audit zero known findings. Earlier 64 PASS PostgreSQL evidence predates this test-runner update; it is not relabeled as a fresh DB run.
- Frontend dependency security checkpoint 2026-09-30: Next.js 15.5.26, Vitest 4.1.11, plugin-react 4.7.0, Vite 6.4.3 and bounded transitive overrides replace 23 reported advisory records. Two large official tarballs were SHA-512 matched to the lockfile, then pinned pnpm 11.23.0 frozen offline restore PASS. Vitest 91 PASS, ESLint PASS, Next production build 11 static pages PASS, pnpm audit zero known vulnerabilities. Vitest upgrade exposed accumulated module mock calls; added clearAllMocks in the polling test afterEach, exact suite and full suite PASS. No Stage 7 activation, tick/event schema or live MT5 claim.
- MC-REM-DB-01 predecision slice 2026-09-30: draft SPEC and ADR record immutable, inactive `MarketRecordEnvelope` with UTC effective/observed as-of, source conflict and time-partition identities; 9 targeted tests PASS, full backend 72 PASS/1 guarded PostgreSQL skip, Ruff check/mypy PASS, new files format PASS. Existing repository-wide format baseline: 28 unrelated files would be reformatted. No migration, collection, taxonomy, retention or Timescale activation; D1-D4 remain external policy decisions.
- MC-REM-BT-02: VERIFIED internal SELL evidence, 10 hand-calculated cases PASS; full backend 82 PASS/1 guarded PostgreSQL skip, Ruff PASS, mypy55 PASS. Existing accepted tests and application unchanged. Evidence: docs/evidence/night-20261002-sell/verification.json and specs/features/backtest-sell-evidence.spec.md. MC-DB01-D1…D4 and TD-BT-001 remain open; independent dependency-free slice does not activate Stage7.
- MC-REM-DB-02 native repository slice 2026-10-02: MC6-R27 VERIFIED internally. Actual SqlAlchemyBacktestRunRepository add/commit/new-session complete BUY/SELL result reload/list/trades/delete/cascade PASS on private disposable PostgreSQL17.6. Clean upgrade0001–0009/check/downgrade0008/reapply0009 PASS, full backend93 PASS/0 skips, Ruff PASS, mypy55 PASS. Exact labelled container stopped/removed; no host volume or real database touched. Evidence docs/evidence/night-20261002-postgres/verification.json and specs/features/postgres-backtest-evidence.spec.md. Remaining query-plan/other access-path proof is an automatic engineering tail; future tick/event tables still depend on DB-01. Historical narrower DB claims above remain historically scoped.
- MC-REM-DB-02 bounded query-plan slice 2026-10-02: 5 selective current-consumer statement shapes exercised actual PostgreSQL plans and matched their existing index paths; 2 global/OR shapes were captured as observations only. Synthetic-only PostgreSQL17.6 full JSON plans retained in docs/evidence/night-20261002-query-plans; clean upgrade/check, query-plan test1 PASS with transaction rollback and fresh-session zero-row readback across all 8 seeded tables, full backend94 PASS/0 skips, Ruff PASS, mypy55 PASS. The private 512MiB/1CPU/128PID, read-only-root container used tmpfs and no host volume; its exact run label was verified absent after stop. No timing claim or schema/index change; additional access paths and future tick/event tables remain. MC-REM-DB-02 remains PARTIAL; D1–D4/TD-BT-001/Stage7 unchanged.
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

Черновик контракта: `specs/features/market-data-storage.spec.md` (DRAFT /
NEEDS_DECISION). Принятый ADR о latest-state quotes остаётся в силе;
evidence rows `MC3-R01/R03/R07/R10/R11` не повышены. `MC-REM-DB-01` остаётся NEXT.

### User action `MC-DB01-DECISION-01`

Additional action MC-HOST-SYMLINK-01: DONE_AUTOMATICALLY 2026-10-02; exact source baseline57ec0c2 plus recorded Docker/package hashes passed frozen Linux Node22.23.3/pnpm11.23.0 install, Next compile/typecheck/static11 pages, standalone image creation and non-root UID1001 loopback HTTP200 smoke. Frontend91 tests PASS and ESLint PASS in network-disabled Linux containers. Existing Node20 Dockerfile defect repaired with immutable official Node22 digest; lock/tests unchanged, host privileges unchanged. Evidence docs/notes/night-linux-frontend-20261002.md and docs/evidence/night-20261002. This closes fresh full-build evidence; Windows symlink capability is not relabeled repaired, and live backend/browser/MT5 gates stay open.

- Status/condition: NEEDS_DECISION до утверждения SPEC, миграций и retention.
- Действие: утвердить или скорректировать `MC-DB01-D1…D4` в черновике SPEC:
  конкретный replay/audit consumer и предел сбора ticks; типы и версии market
  events; сроки/бюджет/архив для ticks/events; PostgreSQL-only сейчас или
  отдельный TimescaleDB rollout. Не передавать реальные рыночные данные или
  секреты в решение.
- Evidence: зафиксированное решение в `docs/DECISIONS.md` и утверждённый SPEC.
- Разблокирует: модели, обратимую миграцию, lifecycle и deterministic tests
  в `MC-REM-DB-01`; не разблокирует Stage 7.

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
