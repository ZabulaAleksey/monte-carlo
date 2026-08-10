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

## Known constraints

- The frontend currently requests at most 2000 candles for a stored run.
- Replay animation is client-side after the completed result and candles are
  loaded.
- Backtest commission and swap are currently explicit run inputs. MT5 deal
  history stores realized commission/swap, but no historical cost profile is
  inferred automatically yet.

## Next reasonable checks

- Validate marker density on runs with many simultaneous positions.
- Profile rendering near the 2000-candle frontend limit.
- Design broker/account/symbol cost profiles from synchronized MT5 deals,
  including long/short swap and rollover rules.
- Continue Stage 3 commits with the stage title in the commit subject.
