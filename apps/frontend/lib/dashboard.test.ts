import { describe, expect, it } from "vitest";

import type { AccountRecord } from "./api/types";
import {
  getDashboardSource,
  selectPortfolioAccount,
  selectSourceCandles,
} from "./dashboard";

const demoAccount: AccountRecord = {
  id: "demo",
  external_id: "DEMO-001",
  name: "Demo",
  currency: "USD",
  balance: "25000",
  created_at: "2026-08-02T10:00:00Z",
};

const mt5Account: AccountRecord = {
  id: "mt5",
  external_id: "10011992327",
  name: "MT5",
  currency: "USD",
  balance: "10000",
  created_at: "2026-08-02T09:00:00Z",
};

describe("dashboard data selection", () => {
  it("selects a non-demo account even when demo data is newer", () => {
    const selected = selectPortfolioAccount([demoAccount, mt5Account]);

    expect(selected).toEqual(mt5Account);
    expect(getDashboardSource(selected)).toBe("mt5");
  });

  it("falls back to demo data when no MT5 account exists", () => {
    const selected = selectPortfolioAccount([demoAccount]);

    expect(selected).toEqual(demoAccount);
    expect(getDashboardSource(selected)).toBe("demo");
  });

  it("does not mix demo candles into an MT5 dashboard", () => {
    const baseCandle = {
      id: "candle",
      symbol_id: "eurusd",
      timeframe: "H1",
      open_time: "2026-08-01T12:00:00Z",
      open: "1.10",
      high: "1.11",
      low: "1.09",
      close: "1.105",
      volume: "100",
    };
    const candles = [
      { ...baseCandle, id: "demo-candle", source: "demo" as const },
      { ...baseCandle, id: "mt5-candle", source: "mt5" as const },
    ];

    expect(selectSourceCandles(candles, "mt5").map((candle) => candle.id)).toEqual([
      "mt5-candle",
    ]);
  });
});
