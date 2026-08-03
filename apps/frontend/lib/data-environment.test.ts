import { describe, expect, it } from "vitest";

import type {
  AccountRecord,
  CandleRecord,
  Mt5Status,
  TradeRecord,
} from "./api/types";
import {
  deriveDataEnvironment,
  filterCandlesForEnvironment,
  filterTradesForEnvironment,
} from "./data-environment";

const status = (connected: boolean): Mt5Status => ({
  configured: true,
  connected,
  stale: !connected,
  stale_after_seconds: 90,
  terminal: null,
});

const account = (id: string, externalId: string): AccountRecord => ({
  id,
  external_id: externalId,
  name: externalId,
  currency: "USD",
  balance: "10000",
  created_at: "2026-08-04T10:00:00Z",
});

const trade = (id: string, accountId: string): TradeRecord => ({
  id,
  account_id: accountId,
  symbol_id: "eurusd",
  external_id: id,
  side: "buy",
  volume: "0.1",
  open_price: "1.1",
  close_price: "1.2",
  opened_at: "2026-08-04T10:00:00Z",
  closed_at: "2026-08-04T11:00:00Z",
  profit: "10",
  commission: "0",
  swap: "0",
  status: "closed",
});

const candle = (id: string, source: CandleRecord["source"]): CandleRecord => ({
  id,
  symbol_id: "eurusd",
  timeframe: "H1",
  open_time: "2026-08-04T10:00:00Z",
  open: "1.1",
  high: "1.2",
  low: "1.0",
  close: "1.15",
  volume: "100",
  source,
});

describe("data environment", () => {
  it("hides demo trades and candles when MT5 data is available", () => {
    const environment = deriveDataEnvironment(
      [account("demo", "DEMO-001"), account("live", "10011992327")],
      status(true),
    );

    expect(environment.title).toBe("MT5 environment");
    expect(filterTradesForEnvironment(
      [trade("DEMO-TRADE-001", "demo"), trade("9001", "live")],
      environment,
    ).map((item) => item.id)).toEqual(["9001"]);
    expect(filterCandlesForEnvironment(
      [candle("demo-candle", "demo"), candle("mt5-candle", "mt5")],
      environment,
    ).map((item) => item.id)).toEqual(["mt5-candle"]);
  });

  it("uses demo data only when no MT5 connection or account exists", () => {
    const environment = deriveDataEnvironment([account("demo", "DEMO-001")], status(false));

    expect(environment.title).toBe("Demo environment");
    expect(filterTradesForEnvironment([trade("demo-trade", "demo")], environment)).toHaveLength(1);
    expect(filterCandlesForEnvironment([candle("demo-candle", "demo")], environment)).toHaveLength(1);
  });
});
