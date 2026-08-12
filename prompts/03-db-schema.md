# Этап 3. Схема рыночных данных

Реализуй этап 3 из `docs/project-context.md`. Расширь существующие модели
PostgreSQL, SQLAlchemy и Alembic вместо создания параллельной схемы. Добавь
TimescaleDB-совместимые ticks, candles и market events, provenance, индексы и
защиту от look-ahead. Не включай расширение TimescaleDB и не выполняй
разрушительную миграцию без отдельного решения. Добавь тесты, обнови релевантную
документацию и остановись после Definition of Done этапа.
