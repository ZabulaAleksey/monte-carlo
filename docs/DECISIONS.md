# Technical decisions

## 2026-08-10 — One replay clock for chart and virtual execution

Status: accepted for Stage 3.

### Decision

`TradeReplay` owns the animated candle index and supplies one exclusive
`visibleBefore` boundary to both the candlestick chart and the virtual trade
ledger. A trade row appears after its entry is reached; close price, exit
reason, costs and P&L remain hidden until the close is reached.

The same visible trade markers are used for entry/exit symbols, dotted
entry-to-exit connections and exit P&L labels. Period separators are derived
from candle timeframe and UTC timestamps.

### Reason

Keeping separate clocks for chart markers and the ledger would reveal future
trade information and make pause, stop and speed controls inconsistent.

### Alternatives considered

- Keep the complete trade ledger visible during animation. Rejected because it
  leaks future executions.
- Store replay position in the page and distribute it to unrelated panels.
  Rejected because the state belongs to the replay workspace.

### Consequences

- Disabling animation immediately reveals the complete historical result.
- The cutoff is exclusive, so an event on the next candle boundary is not
  visible early.
- Replay-specific chart and ledger behavior is tested together.
