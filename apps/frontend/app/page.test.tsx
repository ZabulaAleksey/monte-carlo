import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";

vi.mock("@/components/candlestick-chart", () => ({
  CandlestickChart: ({ label }: { label: string }) => (
    <div role="img" aria-label={`${label} Japanese candlestick chart`} />
  ),
}));

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
import { MARKET_SELECTION_STORAGE_KEY } from "@/hooks/use-persisted-market-selection";

describe("DashboardPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
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
    expect(screen.queryByText("Demo data")).not.toBeInTheDocument();
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

  it("restores the selected symbol and timeframe from localStorage", async () => {
    vi.mocked(apiClient.getAccounts).mockResolvedValue([
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
      { id: "eurusd", name: "EURUSD", description: "Euro", digits: 5, is_active: true },
    ]);
    vi.mocked(apiClient.getCandles).mockResolvedValue([
      {
        id: "xau-h1",
        symbol_id: "xauusd",
        timeframe: "H1",
        open_time: "2026-08-04T12:00:00Z",
        open: "2400",
        high: "2410",
        low: "2390",
        close: "2405",
        volume: "100",
        source: "mt5",
      },
      {
        id: "eur-m15",
        symbol_id: "eurusd",
        timeframe: "M15",
        open_time: "2026-08-04T11:45:00Z",
        open: "1.15000",
        high: "1.15100",
        low: "1.14900",
        close: "1.15050",
        volume: "200",
        source: "mt5",
      },
    ]);

    const firstRender = render(<DashboardPage />);
    const selector = await screen.findByRole("combobox", { name: "Market pulse instrument" });
    fireEvent.change(selector, { target: { value: "eurusd:M15" } });

    expect(window.localStorage.getItem(MARKET_SELECTION_STORAGE_KEY)).toBe("eurusd:M15");
    expect(selector).toHaveValue("eurusd:M15");

    firstRender.unmount();
    render(<DashboardPage />);
    const restoredSelector = await screen.findByRole("combobox", {
      name: "Market pulse instrument",
    });
    await waitFor(() => expect(restoredSelector).toHaveValue("eurusd:M15"));
  });
});
