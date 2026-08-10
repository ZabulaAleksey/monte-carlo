import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { CandlestickTradeChart } from "./candlestick-trade-chart";
import type { CandleRecord, VirtualTradeRecord } from "@/lib/api/types";

const candle = (id: string, openTime: string): CandleRecord => ({
  id,
  symbol_id: "symbol-1",
  timeframe: "H1",
  open_time: openTime,
  open: "100",
  high: "103",
  low: "99",
  close: "101",
  volume: "100",
  source: "demo",
});

const trade: VirtualTradeRecord = {
  sequence: 1,
  side: "buy",
  volume: "1",
  opened_at: "2026-01-31T23:15:00Z",
  closed_at: "2026-02-01T00:30:00Z",
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

describe("CandlestickTradeChart", () => {
  beforeEach(() => cleanup());

  it("renders period guides, trade lifecycle, exit P&L and follows the latest candle", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => 1200,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 300,
    });

    const { container } = render(
      <CandlestickTradeChart
        candles={[
          candle("january", "2026-01-31T23:00:00Z"),
          candle("february", "2026-02-01T00:00:00Z"),
        ]}
        followLatest
        trades={[trade]}
      />,
    );

    const frame = container.querySelector(".chart-frame") as HTMLDivElement;
    expect(frame.scrollLeft).toBe(444);
    expect(container.querySelectorAll(".period-separator")).toHaveLength(1);
    expect(screen.getByText("Feb 01")).toBeInTheDocument();
    expect(container.querySelectorAll(".trade-connection")).toHaveLength(1);
    expect(container.querySelector('[data-trade-sequence="1"]')).toBeInTheDocument();
    expect(screen.getByText("+$2.00")).toBeInTheDocument();
    expect(screen.getByLabelText("Trade 1 exit, P&L +$2.00")).toBeInTheDocument();

    delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  });
});
