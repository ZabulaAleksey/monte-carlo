import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDashboardData } from "./use-dashboard-data";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    getAccounts: vi.fn(),
    getCandles: vi.fn(),
    getQuotes: vi.fn(),
    getSymbols: vi.fn(),
    getTrades: vi.fn(),
    getHistoricalDataRequest: vi.fn(),
    requestHistoricalData: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api/client";

describe("useDashboardData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes only quotes every 500 ms and clears both route timers", async () => {
    vi.mocked(apiClient.getAccounts).mockResolvedValue([]);
    vi.mocked(apiClient.getCandles).mockResolvedValue([]);
    const quote = (bid: string, observedAt: string) => ({
      symbol_id: "eurusd",
      terminal_id: "terminal",
      bid,
      ask: String(Number(bid) + 0.0002),
      observed_at: observedAt,
      received_at: observedAt,
      source: "mt5" as const,
    });
    vi.mocked(apiClient.getQuotes)
      .mockResolvedValueOnce([quote("1.1000", "2026-08-10T10:00:00Z")])
      .mockResolvedValue([quote("1.1010", "2026-08-10T10:00:01Z")]);
    vi.mocked(apiClient.getSymbols).mockResolvedValue([]);
    vi.mocked(apiClient.getTrades).mockResolvedValue([]);
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");

    const { result, unmount } = renderHook(() => useDashboardData());

    await waitFor(() =>
      expect(result.current.data?.quotes[0]?.bid).toBe("1.1000"),
    );
    const quoteTimer = setIntervalSpy.mock.calls.find(([, delay]) => delay === 500);
    expect(quoteTimer).toBeDefined();
    await act(async () => {
      (quoteTimer?.[0] as () => void)();
      await Promise.resolve();
    });

    expect(apiClient.getQuotes).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(result.current.data?.quotes[0]).toMatchObject({
        bid: "1.1010",
        observed_at: "2026-08-10T10:00:01Z",
      }),
    );
    expect(apiClient.getAccounts).toHaveBeenCalledTimes(1);
    expect(apiClient.getCandles).toHaveBeenCalledTimes(1);

    const intervalIds = setIntervalSpy.mock.results.map((result) => result.value);
    unmount();
    for (const intervalId of intervalIds) {
      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    }
  });

  it("loads one selected currency series once and merges its candles", async () => {
    vi.mocked(apiClient.getAccounts).mockResolvedValue([]);
    vi.mocked(apiClient.getCandles)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "gbpjpy-h1",
        symbol_id: "gbpjpy",
        timeframe: "H1",
        open_time: "2026-08-20T10:00:00Z",
        open: "198.100",
        high: "198.300",
        low: "198.000",
        close: "198.250",
        volume: "10",
        source: "mt5",
      }])
      .mockResolvedValue([]);
    vi.mocked(apiClient.getQuotes).mockResolvedValue([]);
    vi.mocked(apiClient.getSymbols).mockResolvedValue([]);
    vi.mocked(apiClient.getTrades).mockResolvedValue([]);
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await act(async () => {
      await Promise.all([
        result.current.loadCandles("gbpjpy", "H1"),
        result.current.loadCandles("gbpjpy", "H1"),
      ]);
    });

    expect(apiClient.getCandles).toHaveBeenCalledTimes(2);
    expect(apiClient.getCandles).toHaveBeenLastCalledWith({
      limit: 500,
      symbolId: "gbpjpy",
      timeframe: "H1",
      source: "mt5",
    });
    expect(result.current.data?.candles).toHaveLength(1);

    const snapshotTimer = setIntervalSpy.mock.calls.find(([, delay]) => delay === 15_000);
    await act(async () => {
      (snapshotTimer?.[0] as () => void)();
      await Promise.resolve();
    });
    await waitFor(() => expect(apiClient.getCandles).toHaveBeenCalledTimes(3));
    expect(result.current.data?.candles).toHaveLength(1);
  });

  it("queues missing timeframe history and refetches candles after MT5 completes it", async () => {
    const candle = {
      id: "eurusd-m5",
      symbol_id: "eurusd",
      timeframe: "M5",
      open_time: "2026-08-21T10:00:00Z",
      open: "1.16900",
      high: "1.17000",
      low: "1.16800",
      close: "1.16950",
      volume: "42",
      source: "mt5" as const,
    };
    vi.mocked(apiClient.getAccounts).mockResolvedValue([]);
    vi.mocked(apiClient.getCandles)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([candle]);
    vi.mocked(apiClient.getQuotes).mockResolvedValue([]);
    vi.mocked(apiClient.getSymbols).mockResolvedValue([]);
    vi.mocked(apiClient.getTrades).mockResolvedValue([]);
    vi.mocked(apiClient.requestHistoricalData).mockResolvedValue({
      id: "history-request",
      symbol_id: "eurusd",
      symbol: "EURUSD",
      timeframe: "M5",
      requested_start: "2026-08-19T16:20:00Z",
      requested_end: "2026-08-21T10:00:00Z",
      status: "completed",
      requested_at: "2026-08-21T10:00:00Z",
      claimed_at: "2026-08-21T10:00:00Z",
      completed_at: "2026-08-21T10:00:01Z",
      terminal_id: "terminal",
      candle_count: 500,
      error: null,
    });

    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await act(async () => {
      await result.current.loadCandles("eurusd", "M5");
    });

    expect(apiClient.requestHistoricalData).toHaveBeenCalledWith(
      "eurusd",
      "M5",
      expect.any(String),
      expect.any(String),
    );
    expect(apiClient.getHistoricalDataRequest).not.toHaveBeenCalled();
    expect(apiClient.getCandles).toHaveBeenLastCalledWith({
      limit: 500,
      symbolId: "eurusd",
      timeframe: "M5",
      source: "mt5",
    });
    expect(result.current.data?.candles).toContainEqual(candle);
    expect(result.current.loadingSeriesKey).toBeNull();
  });

  it("refreshes account and closed trades every two seconds", async () => {
    const account = (balance: string) => ({
      id: "account",
      external_id: "100001",
      name: "MT5",
      currency: "USD",
      balance,
      created_at: "2026-08-20T10:00:00Z",
    });
    vi.mocked(apiClient.getAccounts)
      .mockResolvedValueOnce([account("10000")])
      .mockResolvedValue([account("10100")]);
    vi.mocked(apiClient.getCandles).mockResolvedValue([]);
    vi.mocked(apiClient.getQuotes).mockResolvedValue([]);
    vi.mocked(apiClient.getSymbols).mockResolvedValue([]);
    vi.mocked(apiClient.getTrades).mockResolvedValue([]);
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.data?.accounts[0]?.balance).toBe("10000"));
    const metricsTimer = setIntervalSpy.mock.calls.find(([, delay]) => delay === 2_000);

    await act(async () => {
      (metricsTimer?.[0] as () => void)();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.data?.accounts[0]?.balance).toBe("10100"));
    expect(apiClient.getTrades).toHaveBeenCalledTimes(2);
    expect(apiClient.getTrades).toHaveBeenCalledWith(2_000);
  });

  it("shows portfolio metrics even while the large symbol snapshot is still loading", async () => {
    const account = {
      id: "account",
      external_id: "100001",
      name: "MT5",
      currency: "USD",
      balance: "10300",
      created_at: "2026-08-21T10:00:00Z",
    };
    vi.mocked(apiClient.getAccounts).mockResolvedValue([account]);
    vi.mocked(apiClient.getCandles).mockResolvedValue([]);
    vi.mocked(apiClient.getQuotes).mockResolvedValue([]);
    vi.mocked(apiClient.getSymbols).mockReturnValue(new Promise(() => undefined));
    vi.mocked(apiClient.getTrades).mockResolvedValue([]);
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const { result } = renderHook(() => useDashboardData());
    const metricsTimer = setIntervalSpy.mock.calls.find(([, delay]) => delay === 2_000);

    await act(async () => {
      (metricsTimer?.[0] as () => void)();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.data?.accounts[0]?.balance).toBe("10300"));
    expect(result.current.data?.symbols).toEqual([]);
    expect(result.current.data?.trades).toEqual([]);
  });

  it("does not let an older full snapshot overwrite newer portfolio metrics", async () => {
    const account = (balance: string) => ({
      id: "account",
      external_id: "100001",
      name: "MT5",
      currency: "USD",
      balance,
      created_at: "2026-08-20T10:00:00Z",
    });
    let resolveOldAccounts!: (value: ReturnType<typeof account>[]) => void;
    let resolveOldTrades!: (value: []) => void;
    const oldAccounts = new Promise<ReturnType<typeof account>[]>((resolve) => {
      resolveOldAccounts = resolve;
    });
    const oldTrades = new Promise<[]>((resolve) => {
      resolveOldTrades = resolve;
    });
    vi.mocked(apiClient.getAccounts)
      .mockResolvedValueOnce([account("10000")])
      .mockReturnValueOnce(oldAccounts)
      .mockResolvedValue([account("10200")]);
    vi.mocked(apiClient.getTrades)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(oldTrades)
      .mockResolvedValue([]);
    vi.mocked(apiClient.getCandles).mockResolvedValue([]);
    vi.mocked(apiClient.getQuotes).mockResolvedValue([]);
    vi.mocked(apiClient.getSymbols).mockResolvedValue([]);
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.data?.accounts[0]?.balance).toBe("10000"));
    const snapshotTimer = setIntervalSpy.mock.calls.find(([, delay]) => delay === 15_000);
    const metricsTimer = setIntervalSpy.mock.calls.find(([, delay]) => delay === 2_000);

    await act(async () => {
      (snapshotTimer?.[0] as () => void)();
      await Promise.resolve();
      (metricsTimer?.[0] as () => void)();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.data?.accounts[0]?.balance).toBe("10200"));

    await act(async () => {
      resolveOldAccounts([account("9900")]);
      resolveOldTrades([]);
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.data?.accounts[0]?.balance).toBe("10200"));
  });
});
