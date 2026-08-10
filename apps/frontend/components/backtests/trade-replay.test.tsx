import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TradeReplay } from "./trade-replay";
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

    render(<TradeReplay candles={candles} trades={trades} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(screen.getByLabelText("Follow chart")).toBeChecked();
    ["5\u00d7", "10\u00d7", "20\u00d7", "50\u00d7", "100\u00d7"].forEach((label) => {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    });

    const ledger = screen.getByRole("heading", { name: "Trade ledger" }).closest("section");
    expect(ledger).not.toBeNull();
    expect(within(ledger as HTMLElement).getByText("100.10")).toBeInTheDocument();
    expect(within(ledger as HTMLElement).getByText("Open")).toBeInTheDocument();
    expect(within(ledger as HTMLElement).queryByText("102.10")).not.toBeInTheDocument();
    expect(within(ledger as HTMLElement).queryByText("200.10")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show animated chart"));

    expect(within(ledger as HTMLElement).getByText("102.10")).toBeInTheDocument();
    expect(within(ledger as HTMLElement).getByText("200.10")).toBeInTheDocument();
  });
});
