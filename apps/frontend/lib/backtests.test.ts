import { describe, expect, it } from "vitest";

import type { CandleRecord, VirtualTradeRecord } from "@/lib/api/types";
import {
  buildEquityPath,
  buildPeriodSeparators,
  mapTradesToCandles,
  splitHistoricalIntervalByYear,
  sortCandles,
} from "@/lib/backtests";

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

  it("splits a multi-year historical request at every UTC year boundary", () => {
    expect(
      splitHistoricalIntervalByYear(
        "2023-11-15T00:00:00.000Z",
        "2025-02-10T00:00:00.000Z",
      ),
    ).toEqual([
      {
        startAt: "2023-11-15T00:00:00.000Z",
        endAt: "2024-01-01T00:00:00.000Z",
        year: 2023,
      },
      {
        startAt: "2024-01-01T00:00:00.000Z",
        endAt: "2025-01-01T00:00:00.000Z",
        year: 2024,
      },
      {
        startAt: "2025-01-01T00:00:00.000Z",
        endAt: "2025-02-10T00:00:00.000Z",
        year: 2025,
      },
    ]);
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

  it("does not render a future exit during animated replay", () => {
    const candles = [
      candle("one", "2026-01-01T01:00:00Z"),
      candle("two", "2026-01-01T02:00:00Z"),
    ];

    const markers = mapTradesToCandles(
      candles,
      [trade],
      "2026-01-01T01:45:00Z",
    );

    expect(markers).toEqual([
      expect.objectContaining({ kind: "entry", tradeSequence: 1 }),
    ]);
  });

  it("treats the next candle boundary as an exclusive replay cutoff", () => {
    const candles = [
      candle("one", "2026-01-01T01:00:00Z"),
      candle("two", "2026-01-01T02:00:00Z"),
    ];

    const markers = mapTradesToCandles(candles, [trade], "2026-01-01T02:00:00Z");

    expect(markers).toEqual([
      expect.objectContaining({ kind: "entry", tradeSequence: 1 }),
    ]);
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

  it("adds net profit to the exit marker", () => {
    const markers = mapTradesToCandles(
      [
        candle("one", "2026-01-01T01:00:00Z"),
        candle("two", "2026-01-01T02:00:00Z"),
      ],
      [trade],
    );

    expect(markers[1]).toMatchObject({ kind: "exit", netProfit: 2 });
  });

  it("separates hourly candles by day and weekly candles by month", () => {
    const hourly = [
      candle("late-day", "2026-01-31T23:00:00Z"),
      candle("next-day", "2026-02-01T00:00:00Z"),
    ];
    const weekly = [
      { ...candle("january", "2026-01-26T00:00:00Z"), timeframe: "W1" },
      { ...candle("february", "2026-02-02T00:00:00Z"), timeframe: "W1" },
    ];

    expect(buildPeriodSeparators(hourly, "en-US")).toEqual([
      expect.objectContaining({ candleIndex: 1, label: "Feb 01, 2026" }),
    ]);
    expect(buildPeriodSeparators(weekly, "en-US")).toEqual([
      expect.objectContaining({ candleIndex: 1, label: "Feb 2026" }),
    ]);
  });

  it("builds a stable SVG path for flat equity", () => {
    const path = buildEquityPath(
      [
        { sequence: 1, timestamp: "2026-01-01T00:00:00Z", balance: "1000", equity: "1000", drawdown_pct: "0", drawdown_absolute: "0" },
        { sequence: 2, timestamp: "2026-01-01T01:00:00Z", balance: "1000", equity: "1000", drawdown_pct: "0", drawdown_absolute: "0" },
      ],
      100,
      50,
      10,
    );
    expect(path).toBe("M 10.00 10.00 L 90.00 10.00");
  });
});
