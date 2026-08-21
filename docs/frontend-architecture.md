# Архитектура frontend

## Поток данных

```text
lib/api -> hooks/loaders -> feature model/ViewModel -> feature screen -> app route
```

- `app/**/page.tsx` содержит только Next.js-композицию.
- `features/dashboard`, `features/trades`, `features/market-data` и
  `features/backtesting` владеют экранными сценариями.
- Чистые `model.ts` не импортируют React, DOM, `window`, localStorage или CSS.
- `hooks/use-polling-query.ts` обеспечивает один запрос одновременно,
  игнорирование stale response после cleanup, pause скрытой вкладки и
  сохранение последнего успешного snapshot при временной ошибке.
- Частоты запросов не унифицируются: быстрые quotes/positions остаются
  route-local и прекращаются при уходе со страницы.
- `lib/data-environment.ts` владеет классификацией demo/live account.
- `lib/mt5-connection.ts` преобразует raw MT5 status в presentation state.
- `lib/formatters.ts` принимает locale явно.
- `lib/market-chart.ts` строит геометрию SVG-графика без зависимости от React.

## Инварианты

- Demo и MT5 данные не смешиваются.
- Dashboard сохраняет выбранную пару/таймфрейм в localStorage и выбирает счёт
  активного терминала.
- Trades показывает открытые позиции отдельно от закрытых сделок и считает
  актуальный P&L до JSX.
- Market Data строит индекс символов один раз и сохраняет сортировку между
  realtime-обновлениями.
- Публичные HTTP endpoints и DTO не меняются при frontend-рефакторинге.
- На desktop обе колонки Strategies прокручиваются независимо; mobile
  использует обычную прокрутку страницы.

## Расширение

Новые источники данных добавляются через API loader и чистое правило выбора
environment. Новое глобальное хранилище, WebSocket или другой chart renderer
не требуются до появления отдельного продуктового требования.
