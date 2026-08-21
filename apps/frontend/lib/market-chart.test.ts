import { describe, expect, it } from "vitest";

import { buildMarketChartModel } from "./market-chart";

describe("market chart model", () => {
  it("sorts, bounds and scales candles without React", () => {
    const candle = (id: string, hour: number, close: string) => ({
      id, symbol_id: "s", timeframe: "H1", open_time: `2026-01-01T0${hour}:00:00Z`,
      open: "1", high: close, low: "0.9", close, volume: "1", source: "mt5" as const,
    });
    const model = buildMarketChartModel([candle("2", 2, "1.2"), candle("1", 1, "1.1")], null);

    expect(model?.visible.map((item) => item.id)).toEqual(["1", "2"]);
    expect(model?.levels).toHaveLength(5);
    expect(model?.y(1.2)).toBeLessThan(model?.y(0.9) ?? 0);
  });
});
