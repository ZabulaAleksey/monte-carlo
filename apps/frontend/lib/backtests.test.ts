import { describe, expect, it } from "vitest";

import type { CandleRecord, VirtualTradeRecord } from "@/lib/api/types";
import { buildEquityPath, mapTradesToCandles, sortCandles } from "@/lib/backtests";

const candle = (id: string, openTime: string): CandleRecord => ({
  id,
  symbol_id: "symbol-1",
  timeframe: "H1",
  open_time: openTime,
  open: "100",
  high: "102",
  low: "99",
  close: "101",
  volume: "100",
  source: "demo",
});

const trade: VirtualTradeRecord = {
  sequence: 1,
  side: "buy",
  volume: "1",
  opened_at: "2026-01-01T01:30:00Z",
  closed_at: "2026-01-01T02:00:00Z",
  open_price: "100",
  close_price: "102",
  stop_loss: null,
  take_profit: null,
  exit_reason: "signal",
  gross_profit: "2",
  commission: "0",
  swap: "0",
  net_profit: "2",
};

describe("backtest chart helpers", () => {
  it("sorts candles chronologically without mutating the response", () => {
    const candles = [
      candle("late", "2026-01-01T02:00:00Z"),
      candle("early", "2026-01-01T01:00:00Z"),
    ];

    expect(sortCandles(candles).map((item) => item.id)).toEqual(["early", "late"]);
    expect(candles.map((item) => item.id)).toEqual(["late", "early"]);
  });

  it("places an intrabar fill on its containing candle", () => {
    const candles = [
      candle("one", "2026-01-01T01:00:00Z"),
      candle("two", "2026-01-01T02:00:00Z"),
      candle("three", "2026-01-01T03:00:00Z"),
    ];

    const markers = mapTradesToCandles(candles, [trade]);
    expect(markers[0]).toMatchObject({ candleIndex: 0, kind: "entry" });
    expect(markers[1]).toMatchObject({ candleIndex: 1, kind: "exit" });
  });

  it("keeps a stop reported at candle close on the candle that triggered it", () => {
    const candles = [
      candle("one", "2026-01-01T01:00:00Z"),
      candle("two", "2026-01-01T02:00:00Z"),
    ];
    const stoppedTrade = {
      ...trade,
      closed_at: "2026-01-01T02:00:00Z",
      exit_reason: "stop_loss" as const,
    };

    const markers = mapTradesToCandles(candles, [stoppedTrade]);
    expect(markers[1]).toMatchObject({ candleIndex: 0, kind: "exit" });
  });

  it("builds a stable SVG path for flat equity", () => {
    const path = buildEquityPath(
      [
        { sequence: 1, timestamp: "2026-01-01T00:00:00Z", balance: "1000", equity: "1000", drawdown_pct: "0" },
        { sequence: 2, timestamp: "2026-01-01T01:00:00Z", balance: "1000", equity: "1000", drawdown_pct: "0" },
      ],
      100,
      50,
      10,
    );
    expect(path).toBe("M 10.00 10.00 L 90.00 10.00");
  });
});
