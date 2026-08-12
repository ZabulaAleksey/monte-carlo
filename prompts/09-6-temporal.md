# Этап 9.6. Temporal orchestration

Реализуй опциональный этап 9.6 из `docs/project-context.md` только после
завершения этапа 9 и отдельного подтверждения необходимости. Добавь durable
Temporal workflows для цепочки `import → validate → backtest → Monte Carlo →
optimize → report`, не подменяя без причины исполнение задач RabbitMQ/Celery.
Добавь тесты восстановления и остановись после Definition of Done этапа.
