# AI development status

## Current stage

Stage 3 — Strategy engine and backtesting.

## Implemented

- Framework-independent deterministic backtest domain and persistence.
- Backtest API, saved runs, virtual trades, equity curve and strategy replay.
- Localized EN/RU/UA/BE frontend.
- Animated replay with pause/stop, speeds through 100x and optional chart
  following.
- Progressive Virtual execution ledger without future close information.
- Period separators, entry-to-exit links and exit P&L labels.
- Select-all deletion workflow for Saved research.
- Run-scoped Virtual execution retrieval with an explicit database filter.
- Locale-first bootstrap without an intermediate English render.
- Locale-aware run dates and a $100 starting-capital step.
- MT5 lot minimum/step/maximum and contract-size synchronization, with a 99-lot
  platform cap and lot-aware backtest P&L.
- Configurable monetary swap per lot per crossed calendar day.
- Initial MT5 candle backfill controlled by `CandleLookbackDays` (3650 days by
  default), with visible candle-loading state before simulation.
- Source-confirmed historical coverage cache with range merging, engine-side
  completeness enforcement and reuse of overlapping date intervals.
- A stable `/api/v1/tester/backtests` API namespace and documented contracts
  for external clients.
- Replay Stop preserves the current frame; speed survives run changes; saved
  research opens immediately at its final frame.
- Price charts rescale to the visible viewport; equity charts include a
  drawdown series and labeled equity/drawdown/time axes.
- Price charts include quote-value y axes; equity dates include the year and
  both equity/drawdown animate on the common replay clock.
- Run From/To dates persist in versioned local storage.
- Commission and daily swap use signed notional percentages; slippage uses
  quote points capped at six informative digits.
- Partial historical fallback with persisted requested/actual ranges, visible
  warnings and a 20,000-candle engine/UI limit.
- Absolute drawdown persisted per equity point and rendered on the shared
  monetary axis.
- Dedicated API, PostgreSQL and Guide navigation sections, downloadable tester
  documentation and a standalone multilingual recovery page.
- Fully localized custom calendar and automatic scrolling to run status/equity.
- Durable two-way historical-data requests: website/API enqueue exact From/To,
  MT5 claims with a lease, uploads batches and completes or fails the request.
- All-broker latest quote snapshots with changed-tick batches and a 500 ms
  Market Data-only polling hook that is removed on navigation.
- Equity ordinate now identifies the plotted monetary portfolio-value scale;
  caption minimum/maximum are calculated from equity rather than the offset
  drawdown helper series.
- Public open-position snapshots drive correct `open` status and 500 ms live
  P&L on Trades. The EA filters entry deals out of closed history.
- Dashboard Market pulse uses route-local 500 ms quote-only refreshes; all
  heavier snapshot data keeps its 15-second cadence.
- Market pulse включает все активные валютные пары с котировкой текущего
  источника и лениво загружает до 500 свечей только для выбранной quote-only
  серии; параллельные запросы одной серии дедуплицируются.
- Backtest portfolio lines now plot realized balance and current liquidation
  equity directly, meeting whenever an open position is closed.
- Dashboard разделяет выбор валютной пары и таймфрейма; для каждой активной
  FX-пары доступны M1/M5/M15/M30/H1/H4/D1 с ленивой загрузкой выбранной серии.
- Dashboard сопоставляет баланс с `account_external_id` активного терминала,
  а account/trade метрики обновляет каждые две секунды.
- Реализованный P&L и доля прибыльных рассчитываются по закрытым сделкам с
  учётом commission и swap.
- MT5 считается подключённым по свежему heartbeat или свежей успешной
  аутентифицированной синхронизации; пустой список закрытых сделок допустим.
- EA 2.30 отправляет account snapshot раз в секунду и обновляет закрытую
  историю после `OnTradeTransaction`.

## Known constraints

- A single run currently reads and returns at most 20,000 candles/equity points.
- Replay animation is client-side after the completed result and candles are
  loaded.
- Live quotes are latest sampled snapshots. Complete raw tick history is not
  persisted; that would require a partitioned retention design.
- Классификация FX на Dashboard основана на имени символа и списке валютных
  кодов, поскольку текущий API символов не передаёт отдельный asset class.
- Lot P&L currently uses price difference times MT5 contract size. Instruments
  requiring tick-value or account-currency conversion need a richer profit
  specification in a later iteration.
- Backtest commission and swap are explicit run inputs. MT5 deal
  history stores realized commission/swap, but no historical cost profile is
  inferred automatically yet.

## Next reasonable checks

- Validate marker density on runs with many simultaneous positions.
- Profile rendering near the 20,000-candle frontend limit and design paginated
  delivery for larger data sets.
- Design broker/account/symbol cost profiles from synchronized MT5 deals,
  including long/short swap and rollover rules.
- Add MT5 tick-size/tick-value and profit-currency conversion for instruments
  whose P&L cannot be represented by contract size alone.
- Continue Stage 3 commits with the stage title in the commit subject.
