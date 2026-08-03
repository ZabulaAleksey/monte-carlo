import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chartMocks = vi.hoisted(() => ({
  addSeries: vi.fn(),
  applyOptions: vi.fn(),
  fitContent: vi.fn(),
  remove: vi.fn(),
  setData: vi.fn(),
}));

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: "candlestick-series",
  ColorType: { Solid: "solid" },
  createChart: () => ({
    addSeries: chartMocks.addSeries,
    applyOptions: chartMocks.applyOptions,
    remove: chartMocks.remove,
    timeScale: () => ({ fitContent: chartMocks.fitContent }),
  }),
}));

import { CandlestickChart } from "@/components/candlestick-chart";

class ResizeObserverStub {
  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
}

describe("CandlestickChart", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    chartMocks.addSeries.mockReturnValue({ setData: chartMocks.setData });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses green bullish and red bearish Japanese candles", async () => {
    render(
      <CandlestickChart
        digits={5}
        label="EURUSD M15"
        candles={[
          {
            id: "eur-m15",
            symbol_id: "eurusd",
            timeframe: "M15",
            open_time: "2026-08-04T10:00:00Z",
            open: "1.15000",
            high: "1.15200",
            low: "1.14900",
            close: "1.15100",
            volume: "100",
            source: "mt5",
          },
        ]}
      />,
    );

    expect(screen.getByRole("img")).toHaveAccessibleName(
      /EURUSD M15 Japanese candlestick chart with green bullish and red bearish candles/,
    );
    expect(chartMocks.addSeries).toHaveBeenCalledWith(
      "candlestick-series",
      expect.objectContaining({
        upColor: "#16865f",
        downColor: "#d1534b",
        wickUpColor: "#16865f",
        wickDownColor: "#d1534b",
      }),
    );
    await waitFor(() => expect(chartMocks.setData).toHaveBeenCalledTimes(1));
  });
});
