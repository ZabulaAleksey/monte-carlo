import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MarketDataPage from "./page";

vi.mock("@/lib/page-data", () => ({ loadMarketDataPageData: vi.fn() }));

import { loadMarketDataPageData } from "@/lib/page-data";

describe("MarketDataPage", () => {
  beforeEach(() => {
    vi.mocked(loadMarketDataPageData).mockResolvedValue({
      accounts: [{ id: "live", external_id: "1001", name: "Live", currency: "USD", balance: "10000", created_at: "2026-08-04T10:00:00Z" }],
      mt5: { configured: true, connected: true, stale: false, stale_after_seconds: 90, terminal: null },
      symbols: [{ id: "eurusd", name: "EURUSD", description: "Euro", digits: 5, is_active: true }],
      candles: [
        { id: "demo", symbol_id: "eurusd", timeframe: "H1", open_time: "2026-08-04T09:00:00Z", open: "9.0", high: "9.2", low: "8.9", close: "9.1", volume: "100", source: "demo" },
        { id: "mt5", symbol_id: "eurusd", timeframe: "H1", open_time: "2026-08-04T10:00:00Z", open: "1.1", high: "1.2", low: "1.0", close: "1.15", volume: "200", source: "mt5" },
      ],
    });
  });

  it("shows only MT5 candles in an MT5 environment", async () => {
    render(<MarketDataPage />);

    expect(await screen.findByText("1.15")).toBeInTheDocument();
    expect(screen.queryByText("9.1")).not.toBeInTheDocument();
    expect(screen.getByText("MT5 candles")).toBeInTheDocument();
  });
});
