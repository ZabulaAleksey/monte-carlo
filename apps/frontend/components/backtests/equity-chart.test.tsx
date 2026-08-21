import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { EquityChart } from "./equity-chart";
import type { EquityPointRecord, VirtualTradeRecord } from "@/lib/api/types";

const points: EquityPointRecord[] = [
  { sequence: 1, timestamp: "2026-01-01T00:00:00Z", balance: "10000", equity: "10000", drawdown_pct: "0", drawdown_absolute: "0" },
  { sequence: 2, timestamp: "2026-01-02T00:00:00Z", balance: "10000", equity: "9800", drawdown_pct: "2", drawdown_absolute: "200" },
  { sequence: 3, timestamp: "2026-01-03T00:00:00Z", balance: "10100", equity: "10100", drawdown_pct: "0", drawdown_absolute: "0" },
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

    expect(
      screen.getByRole("img", { name: /Balance and current-liquidation chart/ }),
    ).toBeInTheDocument();
    expect(container.querySelector(".balance-line")).toBeInTheDocument();
    expect(container.querySelector(".liquidation-line")).toBeInTheDocument();
    expect(screen.getByText("Balance (closed P&L)")).toBeInTheDocument();
    expect(screen.getByText("If closed now")).toBeInTheDocument();
    expect(screen.getByText("Portfolio value, USD")).toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Max drawdown $200.00")).toBeInTheDocument();
    expect(screen.queryByText("Drawdown, %")).not.toBeInTheDocument();
    expect(screen.getAllByText(/2026/).length).toBeGreaterThanOrEqual(1);

    const balancePath = container.querySelector(".balance-line")?.getAttribute("d");
    const liquidationPath = container.querySelector(".liquidation-line")?.getAttribute("d");
    expect(balancePath).not.toEqual(liquidationPath);
    expect(balancePath?.split(" L ").at(-1)).toEqual(
      liquidationPath?.split(" L ").at(-1),
    );
  });
});
