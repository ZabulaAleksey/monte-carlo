# MC-REM-BT-02 — SELL evidence slice

Статус: принят existing reconciliation ledger и прямым Night Factory запуском.
Scope: дополнительное исполняемое evidence существующего CPU reference contract,
без изменения engine/public API/financial policy. Dependencies: none; completion
не закрывает TD-BT-001 и не запускает Stage7.

- MC6-R13: signal после закрытия свечи исполняется на следующем open; SELL
  signed P&L=(entry-exit)*lots*contract_size. BUY reversal закрывает short и
  открывает long на том же next open. Same-side signal не открывает дубль.
- MC6-R15: short SL выше entry; если SL и TP внутри одной OHLC candle, действует
  existing stop-first conservative policy; adverse gap закрывает по open.
- MC6-R16: short TP ниже entry; favorable gap закрывает по open.
- Existing costs: slippage ухудшает SELL entry и BUY close, commission начисляется
  на оба notional fills. End-of-data и unrealized drawdown проходят те же правила.

Acceptance: hand-calculated deterministic SELL scenarios, unchanged accepted
tests, full backend/Ruff/mypy. Synthetic prices являются внутренним oracle;
они не заменяют independent MT5/account-currency/tick-value/golden reference.
Requirement owner: docs/reconciliation/stages-3-6-evidence.md MC-REM-BT-02.
