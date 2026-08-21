import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TradeReplay } from "./trade-replay";
import type {
  CandleRecord,
  EquityPointRecord,
  VirtualTradeRecord,
} from "@/lib/api/types";

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

const trade = (
  sequence: number,
  openedAt: string,
  closedAt: string,
  openPrice: string,
  closePrice: string,
): VirtualTradeRecord => ({
  sequence,
  side: "buy",
  volume: "1",
  opened_at: openedAt,
  closed_at: closedAt,
  open_price: openPrice,
  close_price: closePrice,
  stop_loss: null,
  take_profit: null,
  exit_reason: "signal",
  gross_profit: "2",
  commission: "0",
  swap: "0",
  net_profit: "2",
});

describe("TradeReplay", () => {
  beforeEach(() => cleanup());

  it("follows the chart, exposes fast speeds and reveals trades on the replay clock", () => {
    const candles = [
      candle("one", "2026-01-01T00:00:00Z"),
      candle("two", "2026-01-01T01:00:00Z"),
      candle("three", "2026-01-01T02:00:00Z"),
    ];
    const trades = [
      trade(1, "2026-01-01T00:30:00Z", "2026-01-01T01:30:00Z", "100.10", "102.10"),
      trade(2, "2026-01-01T02:15:00Z", "2026-01-01T02:45:00Z", "200.10", "202.10"),
    ];
    const equityPoints: EquityPointRecord[] = [
      { sequence: 1, timestamp: "2026-01-01T01:00:00Z", balance: "1000", equity: "995", drawdown_pct: "0.5", drawdown_absolute: "5" },
      { sequence: 2, timestamp: "2026-01-01T02:00:00Z", balance: "1002", equity: "1002", drawdown_pct: "0", drawdown_absolute: "0" },
      { sequence: 3, timestamp: "2026-01-01T03:00:00Z", balance: "1004", equity: "1004", drawdown_pct: "0", drawdown_absolute: "0" },
    ];

    render(
      <TradeReplay
        candles={candles}
        equityPoints={equityPoints}
        trades={trades}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(screen.getByLabelText("Follow chart")).toBeChecked();
    ["5\u00d7", "10\u00d7", "20\u00d7", "50\u00d7", "100\u00d7"].forEach((label) => {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    });

    const ledger = screen.getByRole("heading", { name: "Trade ledger" }).closest("section");
    expect(ledger).not.toBeNull();
    expect(ledger).toHaveClass("backtest-trades");
    expect(ledger?.querySelector(".backtest-trades-scroll")).toBeInTheDocument();
    expect(within(ledger as HTMLElement).getByText("100.10")).toBeInTheDocument();
    expect(within(ledger as HTMLElement).getByText("Open")).toBeInTheDocument();
    expect(within(ledger as HTMLElement).queryByText("102.10")).not.toBeInTheDocument();
    expect(within(ledger as HTMLElement).queryByText("200.10")).not.toBeInTheDocument();
    expect(screen.getByRole("img", {
      name: /Balance and current-liquidation chart with 1 observations and 0 completed operations/,
    })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show animated chart"));

    expect(within(ledger as HTMLElement).getByText("102.10")).toBeInTheDocument();
    expect(within(ledger as HTMLElement).getByText("200.10")).toBeInTheDocument();
    expect(screen.getByRole("img", {
      name: /Balance and current-liquidation chart with 3 observations and 2 completed operations/,
    })).toBeInTheDocument();
  });

  it("opens saved research at the end and stop preserves the current frame", () => {
    const candles = [
      candle("one", "2026-01-01T00:00:00Z"),
      candle("two", "2026-01-01T01:00:00Z"),
      candle("three", "2026-01-01T02:00:00Z"),
    ];
    const trades = [
      trade(1, "2026-01-01T00:30:00Z", "2026-01-01T01:30:00Z", "100.10", "102.10"),
    ];
    const { rerender } = render(
      <TradeReplay candles={candles} startAtEnd trades={trades} />,
    );

    expect(screen.getByText("Candle 3 of 3")).toBeInTheDocument();
    expect(screen.getByText("102.10")).toBeInTheDocument();

    rerender(<TradeReplay candles={candles} trades={trades} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByText("Candle 1 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.getByText("Candle 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();

    rerender(<TradeReplay key="next-run" candles={candles} trades={trades} />);
    expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled();
  });

  it("enables vertical ledger scrolling only after the tenth visible order", () => {
    const candles = [candle("one", "2026-01-02T00:00:00Z")];
    const trades = Array.from({ length: 11 }, (_, index) => trade(
      index + 1,
      `2026-01-01T${String(index).padStart(2, "0")}:00:00Z`,
      `2026-01-01T${String(index).padStart(2, "0")}:30:00Z`,
      "100.10",
      "102.10",
    ));
    const { rerender } = render(
      <TradeReplay candles={candles} startAtEnd trades={trades.slice(0, 10)} />,
    );

    expect(document.querySelector(".backtest-trades-scroll")).not.toHaveClass("is-scrollable");

    rerender(<TradeReplay candles={candles} startAtEnd trades={trades} />);
    expect(document.querySelector(".backtest-trades-scroll")).toHaveClass("is-scrollable");
  });

  it("shows signed commission and swap impact in the trade ledger", () => {
    const debitSwap = {
      ...trade(1, "2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z", "100", "100"),
      commission: "1",
      swap: "-2",
      net_profit: "-3",
    };
    const creditSwap = {
      ...trade(2, "2026-01-01T02:00:00Z", "2026-01-01T03:00:00Z", "100", "100"),
      commission: "1",
      swap: "5",
      net_profit: "4",
    };
    render(
      <TradeReplay
        candles={[candle("one", "2026-01-02T00:00:00Z")]}
        startAtEnd
        trades={[debitSwap, creditSwap]}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]!).getAllByRole("cell")[7]).toHaveTextContent("-$3.00");
    expect(within(rows[1]!).getAllByRole("cell")[7]).toHaveTextContent("$4.00");
  });

  it("opens either chart in a fullscreen overlay and closes it with Escape", () => {
    const candles = [candle("one", "2026-01-01T00:00:00Z")];
    render(<TradeReplay candles={candles} trades={[]} />);

    const equityFullscreenButton = screen.getByRole("button", {
      name: "Open Equity curve full screen",
    });
    equityFullscreenButton.focus();
    fireEvent.click(equityFullscreenButton);
    expect(screen.getByRole("dialog", { name: "Equity curve" })).toHaveClass(
      "chart-fullscreen",
    );
    expect(document.body).toHaveClass("chart-fullscreen-open");
    expect(screen.getByRole("button", { name: "Exit full screen" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Equity curve" })).not.toBeInTheDocument();
    expect(equityFullscreenButton).toHaveFocus();

    fireEvent.click(screen.getByRole("button", {
      name: "Open Candles and trades full screen",
    }));
    expect(screen.getByRole("dialog", { name: "Candles and trades" })).toHaveClass(
      "chart-fullscreen",
    );
    fireEvent.click(screen.getByRole("button", { name: "Exit full screen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
