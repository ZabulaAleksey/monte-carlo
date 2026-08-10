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

## Known constraints

- The frontend currently requests at most 2000 candles for a stored run.
- Replay animation is client-side after the completed result and candles are
  loaded.
- Lot P&L currently uses price difference times MT5 contract size. Instruments
  requiring tick-value or account-currency conversion need a richer profit
  specification in a later iteration.
- Backtest commission and swap are explicit run inputs. MT5 deal
  history stores realized commission/swap, but no historical cost profile is
  inferred automatically yet.

## Next reasonable checks

- Validate marker density on runs with many simultaneous positions.
- Profile rendering near the 2000-candle frontend limit.
- Design broker/account/symbol cost profiles from synchronized MT5 deals,
  including long/short swap and rollover rules.
- Add MT5 tick-size/tick-value and profit-currency conversion for instruments
  whose P&L cannot be represented by contract size alone.
- Continue Stage 3 commits with the stage title in the commit subject.
