import { describe, expect, it } from "vitest";

import { buildQuoteRows } from "./model";

describe("market data model", () => {
  it("uses a symbol index and a stable symbol tie-breaker", () => {
    const symbols = [
      { id: "b", name: "GBPUSD", description: "", digits: 5, is_active: true, volume_min: "0.01", volume_step: "0.01", volume_max: "99", contract_size: "100000" },
      { id: "a", name: "EURUSD", description: "", digits: 5, is_active: true, volume_min: "0.01", volume_step: "0.01", volume_max: "99", contract_size: "100000" },
    ];
    const quotes = symbols.map((symbol) => ({
      symbol_id: symbol.id, terminal_id: "t", bid: "1", ask: "1.0001",
      observed_at: "2026-01-01T00:00:00Z", received_at: "2026-01-01T00:00:00Z", source: "mt5" as const,
    }));

    expect(buildQuoteRows(quotes, symbols, { key: "spread", direction: "ascending" }).map((row) => row.symbolName))
      .toEqual(["EURUSD", "GBPUSD"]);
  });
});
