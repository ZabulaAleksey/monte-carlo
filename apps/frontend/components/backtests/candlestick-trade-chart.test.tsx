import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const candleAtPrice = (id: string, index: number, price: number): CandleRecord => ({
  ...candle(id, new Date(Date.UTC(2026, 0, 1, index)).toISOString()),
  open: String(price),
  high: String(price + 2),
  low: String(price - 2),
  close: String(price + 1),
});

const trade: VirtualTradeRecord = {
  sequence: 1,
  side: "buy",
  volume: "1",
  opened_at: "2026-01-31T23:15:00Z",
  closed_at: "2026-02-01T00:30:00Z",
  open_price: "100",
  close_price: "102",
  stop_loss: "99",
  take_profit: "103",
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
    expect(screen.getByText(/Feb 01, 2026/)).toBeInTheDocument();
    expect(container.querySelectorAll(".price-axis text")).toHaveLength(5);
    expect(screen.getByText("103.00000")).toBeInTheDocument();
    expect(container.querySelectorAll(".trade-connection")).toHaveLength(1);
    expect(container.querySelectorAll(".trade-risk-level.stop-loss")).toHaveLength(1);
    expect(container.querySelectorAll(".trade-risk-level.take-profit")).toHaveLength(1);
    expect(screen.getByLabelText("#1 SL 99.00000")).toBeInTheDocument();
    expect(screen.getByLabelText("#1 TP 103.00000")).toBeInTheDocument();
    expect(container.querySelector('[data-trade-sequence="1"]')).toBeInTheDocument();
    expect(screen.getByText("+$2.00")).toBeInTheDocument();
    expect(screen.getByLabelText("Trade 1 exit, P&L +$2.00")).toBeInTheDocument();

    delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  });

  it("does not reveal risk levels before the entry candle", () => {
    const { container } = render(
      <CandlestickTradeChart
        candles={[candle("before-entry", "2026-01-31T22:00:00Z")]}
        trades={[trade]}
        visibleUntil="2026-01-31T23:00:00Z"
      />,
    );

    expect(container.querySelector(".trade-risk-level")).not.toBeInTheDocument();
  });

  it("rescales prices from the candles in the visible horizontal viewport", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => 1460,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 300,
    });
    const candles = Array.from({ length: 200 }, (_, index) =>
      candleAtPrice(`candle-${index}`, index, index < 100 ? 100 : 1000),
    );
    const { container } = render(
      <CandlestickTradeChart candles={candles} trades={[]} />,
    );
    const frame = container.querySelector(".chart-frame") as HTMLDivElement;
    const chart = container.querySelector(".candlestick-chart") as SVGSVGElement;

    await waitFor(() => expect(Number(chart.dataset.scaleMax)).toBeLessThan(200));
    frame.scrollLeft = 1000;
    fireEvent.scroll(frame);
    await waitFor(() => expect(Number(chart.dataset.scaleMin)).toBeGreaterThan(900));

    delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  });

  it("renders a bounded viewport while preserving navigation across 20,000 candles", async () => {
    const fullWidth = 20_000 * 7 + 60;
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => fullWidth,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 300,
    });
    const candles = Array.from({ length: 20_000 }, (_, index) =>
      candleAtPrice(`candle-${index}`, index, 100),
    );
    const { container } = render(
      <CandlestickTradeChart candles={candles} trades={[]} />,
    );
    const frame = container.querySelector(".chart-frame") as HTMLDivElement;
    const chart = container.querySelector(".candlestick-chart") as SVGSVGElement;

    expect(container.querySelectorAll(".candle").length).toBeLessThanOrEqual(700);
    await waitFor(() => {
      expect(container.querySelectorAll(".candle").length).toBeLessThan(100);
    });
    expect(chart.style.minWidth).toBe(`${fullWidth}px`);
    expect(chart.getAttribute("viewBox")).toBe(`0 0 ${fullWidth} 320`);
    expect(container.querySelector('[data-candle-index="0"]')).toBeInTheDocument();
    expect(container.querySelector('[data-candle-index="1000"]')).not.toBeInTheDocument();

    frame.scrollLeft = fullWidth - 300;
    fireEvent.scroll(frame);

    await waitFor(() => {
      expect(container.querySelector('[data-candle-index="19999"]')).toBeInTheDocument();
    });
    expect(container.querySelectorAll(".candle").length).toBeLessThan(100);
    expect(container.querySelector('[data-candle-index="0"]')).not.toBeInTheDocument();

    delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  });

  it("keeps a 20,000-candle mount bounded while the chart has zero width", async () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 0,
    });
    const candles = Array.from({ length: 20_000 }, (_, index) =>
      candleAtPrice(`candle-${index}`, index, 100),
    );
    const { container } = render(
      <CandlestickTradeChart candles={candles} trades={[]} />,
    );

    expect(container.querySelectorAll(".candle").length).toBeLessThanOrEqual(700);
    await waitFor(() => {
      expect(container.querySelectorAll(".candle").length).toBeLessThanOrEqual(700);
    });
    expect(container.querySelector('[data-candle-index="19999"]')).not.toBeInTheDocument();

    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  });

  it("follows the latest candle after a zero-width chart becomes visible", async () => {
    const fullWidth = 20_000 * 7 + 60;
    let clientWidth = 0;
    let scrollWidth = 0;
    let triggerResize: (() => void) | undefined;
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        triggerResize = () => callback([], this as unknown as ResizeObserver);
      }
      disconnect(): void {}
      observe(): void {}
      unobserve(): void {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => clientWidth,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => scrollWidth,
    });
    const candles = Array.from({ length: 20_000 }, (_, index) =>
      candleAtPrice(`candle-${index}`, index, 100),
    );
    const { container } = render(
      <CandlestickTradeChart candles={candles} followLatest trades={[]} />,
    );
    const frame = container.querySelector(".chart-frame") as HTMLDivElement;

    expect(frame.scrollLeft).toBe(0);
    expect(container.querySelectorAll(".candle").length).toBeLessThanOrEqual(700);
    clientWidth = 300;
    scrollWidth = fullWidth;
    act(() => triggerResize?.());

    await waitFor(() => {
      expect(container.querySelector('[data-candle-index="19999"]')).toBeInTheDocument();
    });
    expect(frame.scrollLeft).toBeGreaterThan(0);
    expect(container.querySelectorAll(".candle").length).toBeLessThan(100);

    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  });

  it("moves toward the followed candle over intermediate animation frames", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => 1200,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 300,
    });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { container } = render(
      <CandlestickTradeChart
        candles={[
          candle("one", "2026-01-01T00:00:00Z"),
          candle("two", "2026-01-01T01:00:00Z"),
        ]}
        followLatest
        smoothFollow
        trades={[]}
      />,
    );
    const frame = container.querySelector(".chart-frame") as HTMLDivElement;
    expect(frame.scrollLeft).toBe(0);

    act(() => frames.shift()?.(0));

    expect(frame.scrollLeft).toBeGreaterThan(0);
    expect(frame.scrollLeft).toBeLessThan(444);

    act(() => {
      for (let index = 0; index < 80 && frames.length > 0; index += 1) {
        frames.shift()?.(index + 1);
      }
    });
    expect(frame.scrollLeft).toBeCloseTo(444, 0);

    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  });

  it("keeps candle geometry stable while the replay reveals more history", () => {
    const candles = Array.from({ length: 200 }, (_, index) =>
      candleAtPrice(`candle-${index}`, index, 100),
    );
    const { container, rerender } = render(
      <CandlestickTradeChart
        candles={candles}
        trades={[]}
        visibleCandleCount={1}
      />,
    );
    const chart = container.querySelector(".candlestick-chart") as SVGSVGElement;
    const firstWick = container.querySelector('[data-candle-index="0"] line');
    const initialViewBox = chart.getAttribute("viewBox");
    const initialX = firstWick?.getAttribute("x1");

    expect(container.querySelectorAll(".candle")).toHaveLength(1);

    rerender(
      <CandlestickTradeChart
        candles={candles}
        trades={[]}
        visibleCandleCount={2}
      />,
    );

    expect(container.querySelectorAll(".candle")).toHaveLength(2);
    expect(chart.getAttribute("viewBox")).toBe(initialViewBox);
    expect(container.querySelector('[data-candle-index="0"] line')).toHaveAttribute(
      "x1",
      initialX,
    );
  });

  it("keeps trade and risk lines that cross the viewport when markers are outside it", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => 1460,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 300,
    });
    const candles = Array.from({ length: 200 }, (_, index) =>
      candleAtPrice(`candle-${index}`, index, 100),
    );
    const spanningTrade: VirtualTradeRecord = {
      ...trade,
      opened_at: new Date(Date.UTC(2026, 0, 1, 10, 30)).toISOString(),
      closed_at: new Date(Date.UTC(2026, 0, 1, 190, 30)).toISOString(),
    };
    const { container } = render(
      <CandlestickTradeChart candles={candles} trades={[spanningTrade]} />,
    );
    const frame = container.querySelector(".chart-frame") as HTMLDivElement;

    frame.scrollLeft = 700;
    fireEvent.scroll(frame);

    await waitFor(() => {
      expect(container.querySelector(".trade-marker")).not.toBeInTheDocument();
    });
    expect(container.querySelector(".trade-connection")).toBeInTheDocument();
    expect(container.querySelectorAll(".trade-risk-level")).toHaveLength(2);

    delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  });
});
