import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TradesPage from "./page";

vi.mock("@/hooks/use-mt5-status", () => ({
  useMt5Status: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    getAccounts: vi.fn(),
    getPositions: vi.fn(),
    getSymbols: vi.fn(),
    getTrades: vi.fn(),
  },
}));

import { useMt5Status } from "@/hooks/use-mt5-status";
import { apiClient } from "@/lib/api/client";

describe("TradesPage", () => {
  beforeEach(() => {
    vi.mocked(useMt5Status).mockReturnValue({
      error: null,
      status: {
        configured: true,
        connected: true,
        stale: false,
        stale_after_seconds: 90,
        terminal: null,
      },
    });
    vi.mocked(apiClient.getAccounts).mockResolvedValue([
      {
        id: "demo-account",
        external_id: "DEMO-001",
        name: "Demo",
        currency: "USD",
        balance: "25000",
        created_at: "2026-08-10T09:00:00Z",
      },
      {
        id: "live-account",
        external_id: "100001",
        name: "Live",
        currency: "USD",
        balance: "10000",
        created_at: "2026-08-10T10:00:00Z",
      },
    ]);
    vi.mocked(apiClient.getSymbols).mockResolvedValue([
      { id: "eurusd", name: "EURUSD", description: "Euro", digits: 5, is_active: true, volume_min: "0.01", volume_step: "0.01", volume_max: "99", contract_size: "100000" },
    ]);
    vi.mocked(apiClient.getPositions).mockResolvedValue([]);
    vi.mocked(apiClient.getTrades).mockResolvedValue([
      {
        id: "live-trade",
        account_id: "live-account",
        symbol_id: "eurusd",
        external_id: "LIVE-100",
        side: "buy",
        volume: "0.10",
        open_price: "1.10000",
        close_price: "1.10500",
        opened_at: "2026-08-10T10:00:00Z",
        closed_at: "2026-08-10T11:00:00Z",
        profit: "50",
        commission: "-1",
        swap: "0",
        status: "closed",
      },
      {
        id: "demo-trade",
        account_id: "demo-account",
        symbol_id: "eurusd",
        external_id: "DEMO-100",
        side: "sell",
        volume: "0.10",
        open_price: "1.10000",
        close_price: "1.09500",
        opened_at: "2026-08-10T09:00:00Z",
        closed_at: "2026-08-10T10:00:00Z",
        profit: "50",
        commission: "-1",
        swap: "0",
        status: "closed",
      },
    ]);
  });

  it("requests and renders trades only for the live MT5 account", async () => {
    render(<TradesPage />);

    expect(await screen.findByText("LIVE-100")).toBeInTheDocument();
    expect(screen.queryByText("DEMO-100")).not.toBeInTheDocument();
    expect(screen.getByText("100001")).toBeInTheDocument();
    expect(screen.getByText("MT5 online")).toBeInTheDocument();
    expect(apiClient.getTrades).toHaveBeenCalledWith(100, "live-account");
  });

  it("renders an open position and refreshes its net P&L every 500 ms", async () => {
    const openedAt = "2026-08-10T10:00:00Z";
    const position = (profit: string) => ({
      id: "position-1",
      account_id: "live-account",
      symbol_id: "eurusd",
      external_id: "POSITION-1",
      side: "buy" as const,
      volume: "0.10",
      open_price: "1.10000",
      current_price: "1.10400",
      stop_loss: null,
      take_profit: null,
      profit,
      swap: "-0.20",
      opened_at: openedAt,
      observed_at: "2026-08-10T10:00:01Z",
      status: "open" as const,
    });
    vi.mocked(apiClient.getPositions)
      .mockResolvedValueOnce([position("40.00")])
      .mockResolvedValue([position("46.00")]);
    vi.mocked(apiClient.getTrades).mockResolvedValue([
      {
        id: "entry-deal",
        account_id: "live-account",
        symbol_id: "eurusd",
        external_id: "ENTRY-1",
        side: "buy",
        volume: "0.10",
        open_price: "1.10000",
        close_price: "1.10000",
        opened_at: openedAt,
        closed_at: openedAt,
        profit: "0",
        commission: "-1",
        swap: "0",
        status: "closed",
      },
    ]);
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    render(<TradesPage />);

    expect(await screen.findByText("POSITION-1")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("39.80")).toBeInTheDocument();
    expect(screen.queryByText("ENTRY-1")).not.toBeInTheDocument();

    const positionTimer = setIntervalSpy.mock.calls.find(([, delay]) => delay === 500);
    expect(positionTimer).toBeDefined();
    await act(async () => {
      (positionTimer?.[0] as () => void)();
      await Promise.resolve();
    });
    expect(await screen.findByText("45.80")).toBeInTheDocument();
  });
});
