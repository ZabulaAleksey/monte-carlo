# План дальнейшей разработки

Инфраструктурный срез 2026-08-24: миграция frontend npm → pnpm и backend pip/bootstrap → uv lock/sync, clean restores и полный локальный regression pipeline — `DONE`; Docker image build ожидает доступный daemon.

## Текущая цель

Подготовить reconciliation gate перед этапом 7 — «Эталонный Monte Carlo на
CPU». Сам этап 7 не начинается без отдельного прямого запроса пользователя.

Канонический порядок и содержание этапов:
[`MONTE_CARLO_ROADMAP_13_TO_28.md`](MONTE_CARLO_ROADMAP_13_TO_28.md).

## Нумерация и текущая позиция

- Этапы 1–13 являются исходной обязательной дорожной картой.
- Этапы 14–28 являются опциональными и отложены до отдельного решения после
  основной последовательности.
- Работы, ранее называвшиеся «Этап 3. Движок стратегий и бэктестинг»,
  функционально относятся преимущественно к каноническому этапу 6.
- Следующий продуктовый этап — этап 7, но сначала выполняется проверка
  зависимостей и технического долга.

## Reconciliation gate

1. Составить evidence matrix требований этапов 3–5 против текущих моделей,
   API, frontend и тестов; не помечать непроверенные пункты завершёнными.
2. Закрыть `TD-BT-001` либо зафиксировать точную область инструментов, для
   которых P&L доказан эталонными данными.
3. Подготовить SPEC этапа 7: сценарии Monte Carlo, deterministic seed,
   provenance, формат результатов, risk-of-ruin и benchmarks 10k/100k/1M.
4. Использовать [`prompts/07-monte-carlo-cpu.md`](../prompts/07-monte-carlo-cpu.md)
   только после явного запуска этапа пользователем.

## Технический долг

### TD-UI-001 — Устранить мигание карты исполнения

Status: `verified_closed`.

Regression boundary подтверждена между `35e8589` и `2280b79`. Второй
`requestAnimationFrame`-loop ценовой шкалы удалён из production replay: новая
свеча и новый экстремум теперь обрабатываются одним React commit при сохранении
SVG и существующих candle nodes.

Требуется:

- автоматический regression gate для single replay data-reveal clock, stable SVG/candle
  identity и atomic scale update — `PASS`;
- component test для viewport до 20 000 свечей — `PASS`;
- browser visual acceptance на реальном replay при 1x–100x и на границе
  20 000 свечей — `PASS`;
- переходить на Canvas/OffscreenCanvas только если visual evidence после этого
  исправления всё ещё покажет white frame или полную перерисовку.

Проверка в production browser runtime подтвердила отсутствие пустых кадров и
remount SVG/plot/grid/candle nodes на всех поддерживаемых скоростях
`1x, 2x, 4x, 5x, 10x, 20x, 50x, 100x`. Намеренный новый ценовой экстремум
создаёт один atomic scale/geometry update, а горизонтальное сопровождение и
виртуализированный viewport продолжают работать. На границе 20 000 свечей
видимая карта сохранилась при ограниченном количестве DOM-узлов.

NEXT: выполнить reconciliation gate канонического состояния этапов 3–6 и
устранить outstanding stage-state debt. Этап 7 в этот slice не входит.

### TD-BT-001 — Проверить математику прибыли и убытка

Провести независимую сверку бэктестера с golden trades MT5 для BUY и SELL:

- contract size, tick size, tick value и profit currency;
- конвертация в валюту счёта и объём в лотах;
- commission, swap и slippage с корректным знаком;
- signal exit, Stop Loss, Take Profit и bankruptcy;
- balance, equity, realized P&L, unrealized P&L и maximum drawdown.

Критерий закрытия: golden fixtures основных классов инструментов совпадают с
экспортом MT5 в пределах явно заданного денежного допуска, а пограничные случаи
покрыты unit и integration тестами.

## После reconciliation gate

1. Утвердить SPEC этапа 7.
2. Реализовать эталонный Monte Carlo на CPU.
3. Провести deterministic tests и benchmarks.
4. Обновить `AI_STATUS.md` и остановиться без автоматического перехода к
   этапу 8.
