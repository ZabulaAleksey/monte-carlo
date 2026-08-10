import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { EquityChart } from "./equity-chart";
import type { EquityPointRecord, VirtualTradeRecord } from "@/lib/api/types";

const points: EquityPointRecord[] = [
  { sequence: 1, timestamp: "2026-01-01T00:00:00Z", balance: "10000", equity: "10000", drawdown_pct: "0" },
  { sequence: 2, timestamp: "2026-01-02T00:00:00Z", balance: "9900", equity: "9800", drawdown_pct: "2" },
  { sequence: 3, timestamp: "2026-01-03T00:00:00Z", balance: "10100", equity: "10100", drawdown_pct: "0" },
];

const trades: VirtualTradeRecord[] = [{
  sequence: 1,
  side: "buy",
  volume: "0.1",
  opened_at: "2026-01-01T00:00:00Z",
  closed_at: "2026-01-02T00:00:00Z",
  open_price: "1",
  close_price: "2",
  stop_loss: null,
  take_profit: null,
  exit_reason: "signal",
  gross_profit: "-100",
  commission: "0",
  swap: "0",
  net_profit: "-100",
}];

describe("EquityChart", () => {
  beforeEach(() => cleanup());

  it("renders equity, drawdown and labeled axes", () => {
    const { container } = render(<EquityChart points={points} trades={trades} />);

    expect(screen.getByRole("img", { name: /Equity and drawdown chart/ })).toBeInTheDocument();
    expect(container.querySelector(".equity-line")).toBeInTheDocument();
    expect(container.querySelector(".drawdown-line")).toBeInTheDocument();
    expect(screen.getAllByText("Equity").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Drawdown, %")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("2.00%")).toBeInTheDocument();
    expect(screen.getAllByText(/2026/).length).toBeGreaterThanOrEqual(1);
  });
});
