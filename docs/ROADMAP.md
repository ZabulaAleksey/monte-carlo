# Roadmap

## Completed

### Stage 3 — Strategy engine and backtesting

- Historical data provider and deterministic sequential engine.
- Strategy interface and moving-average demonstration strategy.
- Commission, swap, slippage, stop loss and take profit simulation.
- Persisted runs, trades, equity curve and metrics.
- Backtest API and localized research workspace.
- Interactive execution replay and bulk management of saved research.
- Reusable source-confirmed candle ranges and external tester API.
- Synchronized candle/equity/drawdown replay with labeled time and price axes.

## Current

- Validate Stage 3 behavior on larger historical ranges and denser concurrent
  trade sets.
- Refine chart readability without changing deterministic results.

## Planned

- Additional strategy adapters and strategy-specific parameter schemas.
- Historical broker cost profiles derived from synchronized MT5 deals, with
  account/symbol/date scope, commission normalization by volume and separate
  long/short rollover handling.
- Larger-data delivery and rendering optimizations when the 2000-candle UI
  limit becomes restrictive.

## Later / optional

- Monte Carlo simulation.
- Genetic optimization.

These optional items are outside the current Stage 3 scope.
