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
- Partial-range fallback with explicit data-quality evidence and a larger
  20,000-candle ceiling.
- API documentation, read-only PostgreSQL workspace, service guide and
  standalone offline recovery page.

## Current

- Stage 3 is closed. No numbered implementation stage after Stage 3 has been
  approved yet.

## Planned

- Additional strategy adapters and strategy-specific parameter schemas.
- Historical broker cost profiles derived from synchronized MT5 deals, with
  account/symbol/date scope, commission normalization by volume and separate
  long/short rollover handling.
- Larger-data delivery and rendering optimizations when the 20,000-candle UI
  limit becomes restrictive.

## Technical debt carried from Stage 3

- Eliminate the remaining execution-map flicker or replace its rendering
  architecture if retained SVG cannot provide stable frames.
- Independently validate backtest profit/loss mathematics against MT5 golden
  trades, including lot/tick/contract rules, currency conversion, commission,
  swap, slippage and realized/unrealized portfolio values.

Detailed acceptance criteria are maintained in `docs/AI_PLAN.md`.

## Later / optional

- Monte Carlo simulation.
- Genetic optimization.

These optional items are outside the current Stage 3 scope.
