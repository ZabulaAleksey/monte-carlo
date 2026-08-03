import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TradesPage from "./page";

vi.mock("@/lib/page-data", () => ({ loadTradesPageData: vi.fn() }));

import { loadTradesPageData } from "@/lib/page-data";

describe("TradesPage", () => {
  beforeEach(() => {
    vi.mocked(loadTradesPageData).mockResolvedValue({
      accounts: [
        { id: "demo", external_id: "DEMO-001", name: "Demo", currency: "USD", balance: "25000", created_at: "2026-08-04T09:00:00Z" },
        { id: "live", external_id: "1001", name: "Live", currency: "USD", balance: "10000", created_at: "2026-08-04T10:00:00Z" },
      ],
      mt5: { configured: true, connected: true, stale: false, stale_after_seconds: 90, terminal: null },
      symbols: [{ id: "eurusd", name: "EURUSD", description: "Euro", digits: 5, is_active: true }],
      trades: [
        { id: "demo-trade", account_id: "demo", symbol_id: "eurusd", external_id: "DEMO-TRADE-001", side: "buy", volume: "0.1", open_price: "1.1", close_price: "1.2", opened_at: "2026-08-04T09:00:00Z", closed_at: "2026-08-04T10:00:00Z", profit: "10", commission: "0", swap: "0", status: "closed" },
        { id: "live-trade", account_id: "live", symbol_id: "eurusd", external_id: "9001", side: "sell", volume: "0.2", open_price: "1.2", close_price: "1.1", opened_at: "2026-08-04T10:00:00Z", closed_at: "2026-08-04T11:00:00Z", profit: "20", commission: "0", swap: "0", status: "closed" },
      ],
    });
  });

  it("shows only trades belonging to the MT5 account", async () => {
    render(<TradesPage />);

    expect(await screen.findByText("9001")).toBeInTheDocument();
    expect(screen.queryByText("DEMO-TRADE-001")).not.toBeInTheDocument();
    expect(screen.getByText("MT5 history")).toBeInTheDocument();
  });
});
