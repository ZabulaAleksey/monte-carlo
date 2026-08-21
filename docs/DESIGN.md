# Frontend design

## Visual foundation

The interface uses the tokens and panel system defined in
`apps/frontend/app/globals.css`: dark green navigation, light neutral content
surfaces, lime active states, compact monospace values and responsive panels.

## Backtesting workspace

The Strategies route is split into a configuration/research sidebar and a
result workspace. Saved research stays compact and supports row selection plus
one select-all checkbox in the table header.

Starting a run immediately scrolls the result column into view and displays a
live historical-data status. Completion scrolls to the equity panel. An
incomplete provider-confirmed range is shown as an amber warning with candle
count and actual dates; it never appears only below the fold.

## Animated execution map

- Animation, follow-chart, speed and playback controls share one toolbar.
- Follow-chart keeps the latest candle near 72% of the visible chart width so
  upcoming movement and exit labels have space.
- Supported speeds are 0.5x, 1x, 2x, 4x, 5x, 10x, 20x, 50x and 100x.
- Entry markers are triangles; exit markers are circles with a nearby signed
  P&L value.
- A dotted line connects each visible entry and exit pair.
- Vertical dashed separators indicate UTC days for intraday charts, months for
  daily/weekly charts and years for monthly charts.
- While animation is enabled, Virtual execution reveals trades at entry and
  withholds close information until exit. Disabling animation shows all rows.
- The green portfolio curve is realized balance after closed operations. The
  red curve is current liquidation value (`balance + unrealized P&L + swap`).
  They share the replay clock and monetary axis, diverge while a position is
  open and meet at every close. Peak-to-trough drawdown remains a separate
  summary metric in the caption.
- Equity time ticks always include a year. The candle execution map displays
  quote values on its vertical axis with instrument precision capped at six
  digits.
- Selecting saved research replaces the ledger with the trades returned by
  that run's dedicated endpoint; rows from another run are never retained.

## Пульс рынка на Dashboard

- Selector показывает существующие свечные серии и все активные валютные пары
  текущего источника, для которых получена live-котировка.
- Валютные пары распознаются по двум поддерживаемым трёхбуквенным валютным
  кодам; типичные брокерские префиксы и суффиксы имени не скрывают пару.
- Металлы, индексы и криптовалюты не добавляются как FX только из-за наличия
  котировки, но остаются доступны, если для них уже есть свечная серия.
- История quote-only пары или нового таймфрейма загружается после выбора через
  durable MT5 historical request примерно на 500 свечей. До completion вместо
  пустого графика отображается локализованное состояние загрузки.
- Account/trades могут первыми сформировать карточки портфеля, не ожидая
  загрузки полного каталога брокерских символов.
- Выбор серии сохраняется в `montecarlo.dashboard.market-series.v1`.

## Localized run configuration

- The application renders a neutral bootstrap until the versioned locale key
  has been read from local storage, preventing an English frame before the
  selected language appears.
- The active locale updates the document language and a custom date-time
  calendar. Month, weekday, navigation, time and date formatting therefore
  follow the selected site language instead of the operating-system picker.
- Starting capital uses a $100 minimum and step so mouse spinner controls
  change the value in $100 increments.
- The selected From/To values use the versioned
  `montecarlo.backtest.period.v1` local-storage record and are restored before
  the form's first meaningful render.
- Stress inputs show their calculation units directly: commission percentage
  per execution, signed daily swap percentage and quote-point slippage.

## Responsive and accessible behavior

The chart scrolls inside its own frame and must not create document-level
horizontal overflow. Controls use native labels, checkboxes and buttons;
visual-only SVG elements retain translated accessible labels on meaningful
markers and exits.

## Service and recovery sections

- `/api-docs` links Swagger/OpenAPI and downloads a repository-local Markdown
  contract that remains available when the backend is offline.
- `/database` presents a read-only PostgreSQL overview and cached candle ranges.
- `/guide` documents Docker, Alembic, MT5, market-data verification and tester
  startup in EN/RU/UA/BE.
- A service banner links to the guide when backend or MT5 is offline.
- `public/offline/index.html` is a self-contained localized recovery page that
  can be opened directly when no Docker container is running.

## Dashboard: выбор рынка и метрики портфеля

- Валютная пара и таймфрейм выбираются двумя независимыми полями. Для FX
  доступны `M1`, `M5`, `M15`, `M30`, `H1`, `H4`, `D1`; итоговый
  ключ серии сохраняется в прежнем local-storage контракте.
- Баланс относится к счёту активного терминала MT5, определяемому по
  `account_external_id`.
- «Реализованный P&L» учитывает только закрытые сделки и показывает
  `profit + commission + swap`. Доля прибыльных использует тот же чистый
  результат сделки.
