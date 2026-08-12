# Промпты будущих этапов

Эти короткие промпты запускают этапы 3–13 из канонического
[`docs/project-context.md`](../docs/project-context.md). Они не являются
отдельной спецификацией и не переопределяют фактическую архитектуру из
[`docs/architecture.md`](../docs/architecture.md), локальный `AGENTS.md` или
более позднюю прямую инструкцию пользователя.

Перед выполнением промпта нужно изучить существующий код и документацию,
проверить завершённость зависимых этапов и при необходимости создать или
обновить SPEC. Выполняется только один явно запрошенный этап; автоматический
переход к следующему запрещён.

| Этап | Промпт |
| --- | --- |
| 3 | [`03-db-schema.md`](03-db-schema.md) |
| 4 | [`04-fastapi-core.md`](04-fastapi-core.md) |
| 5 | [`05-ui-baseline.md`](05-ui-baseline.md) |
| 6 | [`06-backtest-cpu.md`](06-backtest-cpu.md) |
| 7 | [`07-monte-carlo-cpu.md`](07-monte-carlo-cpu.md) |
| 8 | [`08-genetic-reports.md`](08-genetic-reports.md) |
| 9 | [`09-rabbitmq-workers.md`](09-rabbitmq-workers.md) |
| 9.6 | [`09-6-temporal.md`](09-6-temporal.md) |
| 10 | [`10-arrow-parquet-duckdb.md`](10-arrow-parquet-duckdb.md) |
| 10.5 | [`10-5-hal.md`](10-5-hal.md) |
| 11 | [`11-accelerators.md`](11-accelerators.md) |
| 12 | [`12-cuda-graphs-profiling.md`](12-cuda-graphs-profiling.md) |
| 13 | [`13-realtime-ai-future.md`](13-realtime-ai-future.md) |
