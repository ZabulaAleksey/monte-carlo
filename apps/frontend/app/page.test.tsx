import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    getAccounts: vi.fn(),
    getCandles: vi.fn(),
    getMt5Status: vi.fn(),
    getSymbols: vi.fn(),
    getTrades: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api/client";

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.getAccounts).mockResolvedValue([]);
    vi.mocked(apiClient.getCandles).mockResolvedValue([]);
    vi.mocked(apiClient.getMt5Status).mockResolvedValue({
      configured: true,
      connected: true,
      stale: false,
      stale_after_seconds: 90,
      terminal: {
        terminal_id: "terminal-test",
        terminal_name: "MetaTrader 5",
        terminal_build: 5000,
        last_heartbeat_at: "2026-08-02T12:00:00Z",
        terminal_time: "2026-08-02T12:00:00Z",
        last_sync_at: "2026-08-02T12:00:00Z",
      },
    });
    vi.mocked(apiClient.getSymbols).mockResolvedValue([]);
    vi.mocked(apiClient.getTrades).mockResolvedValue([]);
  });

  it("loads the dashboard shell and data", async () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Trading performance, in focus." })).toBeInTheDocument();
    expect(await screen.findByText("Portfolio balance")).toBeInTheDocument();
    expect(screen.getByText("No account data")).toBeInTheDocument();
  });

  it("prefers the MT5 account over demo data and identifies the live source", async () => {
    vi.mocked(apiClient.getAccounts).mockResolvedValue([
      {
        id: "demo-account",
        external_id: "DEMO-001",
        name: "Demo Portfolio",
        currency: "USD",
        balance: "25000",
        created_at: "2026-08-02T10:00:00Z",
      },
      {
        id: "mt5-account",
        external_id: "10011992327",
        name: "MT5 Account",
        currency: "USD",
        balance: "10000",
        created_at: "2026-08-02T12:00:00Z",
      },
    ]);
    vi.mocked(apiClient.getSymbols).mockResolvedValue([
      { id: "xauusd", name: "XAUUSD", description: "Gold", digits: 2, is_active: true },
    ]);
    vi.mocked(apiClient.getCandles).mockResolvedValue([
      {
        id: "candle-1",
        symbol_id: "xauusd",
        timeframe: "H1",
        open_time: "2026-08-01T12:00:00Z",
        open: "4050.00",
        high: "4060.00",
        low: "4040.00",
        close: "4055.00",
        volume: "100",
        source: "mt5",
      },
    ]);

    render(<DashboardPage />);

    expect(await screen.findByText("$10,000.00")).toBeInTheDocument();
    expect(screen.queryByText("$35,000.00")).not.toBeInTheDocument();
    expect(screen.getByText(/MT5 account · online · 10011992327/)).toBeInTheDocument();
    expect(screen.getByText("XAUUSD · H1")).toBeInTheDocument();
    expect(screen.getByText("4055.00")).toBeInTheDocument();
    expect(screen.getByText("MT5 candles")).toBeInTheDocument();
  });
});
