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

## Known constraints

- The frontend currently requests at most 2000 candles for a stored run.
- Replay animation is client-side after the completed result and candles are
  loaded.

## Next reasonable checks

- Validate marker density on runs with many simultaneous positions.
- Profile rendering near the 2000-candle frontend limit.
- Continue Stage 3 commits with the stage title in the commit subject.
