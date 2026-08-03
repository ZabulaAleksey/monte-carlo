import { describe, expect, it } from "vitest";

import type { CandleRecord } from "@/lib/api/types";
import { toCandlestickData } from "@/lib/market-chart";

function candle(overrides: Partial<CandleRecord> = {}): CandleRecord {
  return {
    id: "candle-1",
    symbol_id: "eurusd",
    timeframe: "M15",
    open_time: "2026-08-04T10:00:00Z",
    open: "1.15000",
    high: "1.15200",
    low: "1.14900",
    close: "1.15100",
    volume: "100",
    source: "mt5",
    ...overrides,
  };
}

describe("toCandlestickData", () => {
  it("converts OHLC strings and sorts candles from oldest to newest", () => {
    const result = toCandlestickData([
      candle({ id: "newer", open_time: "2026-08-04T10:15:00Z" }),
      candle({ id: "older", open_time: "2026-08-04T10:00:00Z" }),
    ]);

    expect(result).toEqual([
      {
        time: Date.parse("2026-08-04T10:00:00Z") / 1_000,
        open: 1.15,
        high: 1.152,
        low: 1.149,
        close: 1.151,
      },
      {
        time: Date.parse("2026-08-04T10:15:00Z") / 1_000,
        open: 1.15,
        high: 1.152,
        low: 1.149,
        close: 1.151,
      },
    ]);
  });

  it("drops malformed candles instead of breaking the chart", () => {
    const result = toCandlestickData([
      candle({ id: "invalid-price", open: "not-a-price" }),
      candle({ id: "invalid-range", high: "1.14000" }),
      candle({ id: "valid" }),
    ]);

    expect(result).toHaveLength(1);
  });
});
