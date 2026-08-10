import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    getAccounts: vi.fn(),
    getCandles: vi.fn(),
    getQuotes: vi.fn(),
    getSymbols: vi.fn(),
    getTrades: vi.fn(),
  },
}));

vi.mock("@/hooks/use-mt5-status", () => ({
  useMt5Status: vi.fn(),
}));

import { useMt5Status } from "@/hooks/use-mt5-status";
import { apiClient } from "@/lib/api/client";
import { I18nProvider } from "@/lib/i18n";

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.getAccounts).mockResolvedValue([]);
    vi.mocked(apiClient.getCandles).mockResolvedValue([]);
    vi.mocked(useMt5Status).mockReturnValue({
      error: null,
      status: {
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
      },
    });
    vi.mocked(apiClient.getQuotes).mockResolvedValue([]);
    vi.mocked(apiClient.getSymbols).mockResolvedValue([]);
    vi.mocked(apiClient.getTrades).mockResolvedValue([]);
    window.localStorage.clear();
  });

  it("loads the dashboard shell and data", async () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Trading performance, in focus." })).toBeInTheDocument();
    expect(await screen.findByText("Portfolio balance")).toBeInTheDocument();
    expect(screen.getByText("No account data")).toBeInTheDocument();
    expect(screen.queryByText("Demo data")).not.toBeInTheDocument();
  });

  it("translates the complete dashboard surface from the stored locale", async () => {
    window.localStorage.setItem("montecarlo.locale.v1", "be");

    render(
      <I18nProvider>
        <DashboardPage />
      </I18nProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Гандлёвыя вынікі ў фокусе." }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Баланс партфеля")).toBeInTheDocument();
    expect(screen.getByText("Няма даных рахунку")).toBeInTheDocument();
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
    vi.mocked(apiClient.getQuotes).mockResolvedValue([
      {
        symbol_id: "xauusd",
        terminal_id: "terminal-test",
        bid: "4054.80",
        ask: "4055.20",
        observed_at: "2026-08-01T12:30:00Z",
        received_at: "2026-08-01T12:30:01Z",
        source: "mt5",
      },
    ]);

    render(<DashboardPage />);

    expect(await screen.findByText("$10,000.00")).toBeInTheDocument();
    expect(screen.queryByText("$35,000.00")).not.toBeInTheDocument();
    expect(screen.getByText("10011992327")).toBeInTheDocument();
    expect(screen.getByText("XAUUSD · H1")).toBeInTheDocument();
    expect(screen.getByText("4054.80")).toBeInTheDocument();
    expect(screen.getByText("4055.20")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Japanese candlestick chart for XAUUSD/ }),
    ).toBeInTheDocument();
  });

  it("restores and saves the selected market series", async () => {
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
      { id: "eurusd", name: "EURUSD", description: "Euro", digits: 5, is_active: true },
      { id: "xauusd", name: "XAUUSD", description: "Gold", digits: 2, is_active: true },
    ]);
    vi.mocked(apiClient.getCandles).mockResolvedValue([
      {
        id: "eur-candle",
        symbol_id: "eurusd",
        timeframe: "H1",
        open_time: "2026-08-01T12:00:00Z",
        open: "1.08000",
        high: "1.09000",
        low: "1.07000",
        close: "1.08500",
        volume: "100",
        source: "mt5",
      },
      {
        id: "xau-candle",
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
    window.localStorage.setItem(
      "montecarlo.dashboard.market-series.v1",
      "eurusd:H1",
    );

    const first = render(<DashboardPage />);
    const select = await screen.findByRole("combobox", {
      name: "Market pulse instrument",
    });
    expect(select).toHaveValue("eurusd:H1");
    fireEvent.change(select, { target: { value: "xauusd:H1" } });
    expect(window.localStorage.getItem("montecarlo.dashboard.market-series.v1")).toBe(
      "xauusd:H1",
    );
    first.unmount();

    render(<DashboardPage />);
    expect(
      await screen.findByRole("combobox", { name: "Market pulse instrument" }),
    ).toHaveValue("xauusd:H1");
  });
});
