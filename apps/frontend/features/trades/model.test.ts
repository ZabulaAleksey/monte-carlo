import { describe, expect, it } from "vitest";

import { buildExecutionRows } from "./model";

describe("trades model", () => {
  it("keeps open positions open and calculates live P&L", () => {
    const rows = buildExecutionRows([{
      id: "p", account_id: "a", external_id: "7", symbol_id: "s", side: "buy",
      volume: "1", open_price: "1", current_price: "1.1", stop_loss: null,
      take_profit: null, profit: "12", swap: "-2", opened_at: "2026-01-01T00:00:00Z",
      observed_at: "2026-01-01T00:00:01Z", status: "open",
    }], [], [{
      id: "s", name: "EURUSD", description: "", digits: 5, is_active: true,
      volume_min: "0.01", volume_step: "0.01", volume_max: "99", contract_size: "100000",
    }]);

    expect(rows[0]).toMatchObject({ status: "open", pnl: 10, symbolName: "EURUSD" });
  });
});
