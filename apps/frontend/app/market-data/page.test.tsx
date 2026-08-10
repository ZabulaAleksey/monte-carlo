import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MarketDataPage from "./page";

vi.mock("@/hooks/use-mt5-status", () => ({
  useMt5Status: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    getCandles: vi.fn(),
    getQuotes: vi.fn(),
    getSymbols: vi.fn(),
  },
}));

import { useMt5Status } from "@/hooks/use-mt5-status";
import { apiClient } from "@/lib/api/client";

const onlineStatus = {
  configured: true,
  connected: true,
  stale: false,
  stale_after_seconds: 90,
  terminal: null,
};

describe("MarketDataPage", () => {
  beforeEach(() => {
    vi.mocked(useMt5Status).mockReturnValue({ error: null, status: onlineStatus });
    vi.mocked(apiClient.getSymbols).mockResolvedValue([
      { id: "eurusd", name: "EURUSD", description: "Euro", digits: 5, is_active: true, volume_min: "0.01", volume_step: "0.01", volume_max: "99", contract_size: "100000" },
    ]);
    vi.mocked(apiClient.getCandles).mockResolvedValue([
      {
        id: "mt5-candle",
        symbol_id: "eurusd",
        timeframe: "H1",
        open_time: "2026-08-10T10:00:00Z",
        open: "1.10000",
        high: "1.11000",
        low: "1.09000",
        close: "1.10555",
        volume: "100",
        source: "mt5",
      },
      {
        id: "demo-candle",
        symbol_id: "eurusd",
        timeframe: "H1",
        open_time: "2026-08-10T09:00:00Z",
        open: "1.00000",
        high: "1.01000",
        low: "0.99000",
        close: "1.00555",
        volume: "100",
        source: "demo",
      },
    ]);
    vi.mocked(apiClient.getQuotes).mockResolvedValue([
      {
        symbol_id: "eurusd",
        terminal_id: "terminal-1",
        bid: "1.10550",
        ask: "1.10570",
        observed_at: "2026-08-10T10:05:00Z",
        received_at: "2026-08-10T10:05:00Z",
        source: "mt5",
      },
    ]);
  });

  it("requests and renders only MT5 candles while connected", async () => {
    render(<MarketDataPage />);

    expect(await screen.findByText("1.10555")).toBeInTheDocument();
    expect(screen.queryByText("1.00555")).not.toBeInTheDocument();
    expect(await screen.findByText("1.10550")).toBeInTheDocument();
    expect(screen.getByText("All broker instruments")).toBeInTheDocument();
    expect(screen.getByText("MT5 online")).toBeInTheDocument();
    expect(apiClient.getCandles).toHaveBeenCalledWith({ limit: 100, source: "mt5" });
  });

  it("uses demo candles while MT5 is offline", async () => {
    vi.mocked(useMt5Status).mockReturnValue({
      error: null,
      status: { ...onlineStatus, connected: false, stale: true },
    });
    vi.mocked(apiClient.getCandles).mockResolvedValue([
      {
        id: "demo-candle",
        symbol_id: "eurusd",
        timeframe: "H1",
        open_time: "2026-08-10T09:00:00Z",
        open: "1.00000",
        high: "1.01000",
        low: "0.99000",
        close: "1.00555",
        volume: "100",
        source: "demo",
      },
    ]);
    vi.mocked(apiClient.getQuotes).mockResolvedValue([]);

    render(<MarketDataPage />);

    expect(await screen.findByText("1.00555")).toBeInTheDocument();
    expect(screen.getByText("Demo fallback")).toBeInTheDocument();
    expect(apiClient.getCandles).toHaveBeenCalledWith({ limit: 100, source: "demo" });
  });
});
