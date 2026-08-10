import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StrategiesPage from "./page";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    createBacktest: vi.fn(),
    deleteBacktest: vi.fn(),
    getBacktestResult: vi.fn(),
    getBacktestJob: vi.fn(),
    getBacktestRuns: vi.fn(),
    getBacktestStrategies: vi.fn(),
    getBacktestTrades: vi.fn(),
    getCandles: vi.fn(),
    getSymbols: vi.fn(),
    pauseBacktestJob: vi.fn(),
    resumeBacktestJob: vi.fn(),
    startBacktestJob: vi.fn(),
    stopBacktestJob: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api/client";
import type { BacktestResultRecord } from "@/lib/api/types";
import { I18nProvider } from "@/lib/i18n";

const result: BacktestResultRecord = {
  id: "run-1",
  created_at: "2026-01-01T08:00:00Z",
  symbol_id: "symbol-1",
  timeframe: "H1",
  requested_start: "2026-01-01T00:00:00Z",
  requested_end: "2026-01-01T07:00:00Z",
  data_start: "2026-01-01T00:00:00Z",
  data_end: "2026-01-01T07:00:00Z",
  candle_count: 8,
  strategy_name: "moving_average_cross",
  strategy_version: "1.0.0",
  parameters: { short_window: 2, long_window: 3 },
  settings: {
    initial_capital: "10000",
    position_size: "1",
    contract_size: "100000",
    stop_loss_pct: "1",
    take_profit_pct: "2",
    commission_per_fill: "0",
    swap_per_lot_per_day: "0",
    slippage_mode: "fixed",
    slippage_value: "0",
  },
  trades: [
    {
      sequence: 1,
      side: "buy",
      volume: "1",
      opened_at: "2026-01-01T05:00:00Z",
      closed_at: "2026-01-01T07:00:00Z",
      open_price: "4",
      close_price: "5",
      stop_loss: null,
      take_profit: null,
      exit_reason: "end_of_data",
      gross_profit: "1",
      commission: "0",
      swap: "0",
      net_profit: "1",
    },
  ],
  equity_curve: [
    { sequence: 1, timestamp: "2026-01-01T00:00:00Z", balance: "10000", equity: "10000", drawdown_pct: "0" },
    { sequence: 2, timestamp: "2026-01-01T07:00:00Z", balance: "10001", equity: "10001", drawdown_pct: "0" },
  ],
  metrics: {
    initial_capital: "10000",
    final_balance: "10001",
    final_equity: "10001",
    total_net_profit: "1",
    return_pct: "0.01",
    max_drawdown_pct: "0",
    total_trades: 1,
    winning_trades: 1,
    losing_trades: 0,
    win_rate_pct: "100",
    profit_factor: null,
    total_commission: "0",
    total_swap: "0",
  },
};

describe("StrategiesPage", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(apiClient.getSymbols).mockResolvedValue([
      {
        id: "symbol-1",
        name: "EURUSD",
        description: "Euro",
        digits: 5,
        is_active: true,
        volume_min: "0.01",
        volume_step: "0.01",
        volume_max: "100",
        contract_size: "100000",
      },
    ]);
    vi.mocked(apiClient.getBacktestStrategies).mockResolvedValue([
      {
        name: "moving_average_cross",
        version: "1.0.0",
        title: "Moving average crossover",
        description: "Demonstration strategy for infrastructure validation only.",
        parameters: [
          { name: "short_window", label: "Fast MA period", value_type: "integer", default: 2, minimum: 1, maximum: 200 },
          { name: "long_window", label: "Slow MA period", value_type: "integer", default: 3, minimum: 2, maximum: 500 },
          { name: "position_size", label: "Position size / lots", value_type: "decimal", default: 0.01, minimum: 0.01, maximum: 99 },
          { name: "stop_loss_pct", label: "Stop loss / %", value_type: "decimal", default: 1, minimum: 0.0001, maximum: 100 },
          { name: "take_profit_pct", label: "Take profit / %", value_type: "decimal", default: 2, minimum: 0.0001, maximum: 1000 },
        ],
      },
    ]);
    vi.mocked(apiClient.getBacktestRuns).mockResolvedValue([]);
    vi.mocked(apiClient.getCandles).mockResolvedValue([
      {
        id: "candle-1",
        symbol_id: "symbol-1",
        timeframe: "H1",
        open_time: "2026-01-01T05:00:00Z",
        open: "4",
        high: "5",
        low: "3",
        close: "4.5",
        volume: "100",
        source: "demo",
      },
      {
        id: "candle-2",
        symbol_id: "symbol-1",
        timeframe: "H1",
        open_time: "2026-01-01T06:00:00Z",
        open: "4.5",
        high: "5.2",
        low: "4",
        close: "5",
        volume: "100",
        source: "demo",
      },
      {
        id: "candle-3",
        symbol_id: "symbol-1",
        timeframe: "H1",
        open_time: "2026-01-01T07:00:00Z",
        open: "5",
        high: "5.5",
        low: "4.8",
        close: "5.2",
        volume: "100",
        source: "demo",
      },
    ]);
    vi.mocked(apiClient.createBacktest).mockResolvedValue(result);
    vi.mocked(apiClient.startBacktestJob).mockResolvedValue({
      id: "job-1",
      state: "completed",
      stage: "completed",
      progress_pct: "100",
      processed_candles: 8,
      total_candles: 8,
      result_id: result.id,
      error: null,
    });
    vi.mocked(apiClient.getBacktestResult).mockResolvedValue(result);
    vi.mocked(apiClient.getBacktestTrades).mockResolvedValue(result.trades);
  });

  it("loads the research form and renders a completed result", async () => {
    render(<StrategiesPage />);

    expect(await screen.findByRole("heading", { name: "Run configuration" })).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveAttribute("lang", "en-US");
    expect(screen.getByLabelText("To")).toHaveAttribute("lang", "en-US");
    expect(screen.getByLabelText("Starting capital")).toHaveAttribute("min", "100");
    expect(screen.getByLabelText("Starting capital")).toHaveAttribute("step", "100");
    const positionSize = screen.getByLabelText("Position size / lots");
    expect(positionSize).toHaveAttribute("min", "0.01");
    expect(positionSize).toHaveAttribute("step", "0.01");
    expect(positionSize).toHaveAttribute("max", "99");
    fireEvent.change(positionSize, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Run backtesting" }));

    await waitFor(() =>
      expect(apiClient.startBacktestJob).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy_name: "moving_average_cross",
          symbol_id: "symbol-1",
          timeframe: "H1",
          parameters: {
            short_window: 2,
            long_window: 3,
            position_size: "1",
            stop_loss_pct: "1",
            take_profit_pct: "2",
          },
        }),
      ),
    );
    expect((await screen.findAllByText("$10,001.00")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("img", { name: /Equity and drawdown chart with 2 observations and 1 completed operations/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Candlestick chart with 1 virtual trades/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trade ledger" })).toBeInTheDocument();
  });

  it("opens a saved chart and deletes selected research", async () => {
    const secondRun = {
      id: "run-2",
      created_at: "2026-01-02T08:00:00Z",
      symbol_id: result.symbol_id,
      timeframe: result.timeframe,
      strategy_name: result.strategy_name,
      strategy_version: result.strategy_version,
      data_start: result.data_start,
      data_end: result.data_end,
      total_trades: 2,
      final_balance: "9999",
      return_pct: "-0.01",
    };
    vi.mocked(apiClient.getBacktestRuns)
      .mockResolvedValueOnce([
        {
          id: result.id,
          created_at: result.created_at,
          symbol_id: result.symbol_id,
          timeframe: result.timeframe,
          strategy_name: result.strategy_name,
          strategy_version: result.strategy_version,
          data_start: result.data_start,
          data_end: result.data_end,
          total_trades: 1,
          final_balance: "10001",
          return_pct: "0.01",
        },
        secondRun,
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(apiClient.getBacktestResult).mockImplementation(async (runId) => ({
      ...result,
      id: runId,
    }));

    render(<StrategiesPage />);

    const openCharts = await screen.findAllByRole("button", {
      name: /Open history and trade chart/,
    });
    fireEvent.click(openCharts[0] as HTMLElement);
    expect(await screen.findByRole("heading", { name: "Trade ledger" })).toBeInTheDocument();
    expect(screen.getByText("Candle 3 of 3")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Speed"), { target: { value: "10" } });
    fireEvent.click(openCharts[1] as HTMLElement);
    await waitFor(() => expect(screen.getByLabelText("Speed")).toHaveValue("10"));
    expect(screen.getByText("Candle 3 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all research" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));

    await waitFor(() => expect(apiClient.deleteBacktest).toHaveBeenCalledWith(result.id));
    expect(apiClient.deleteBacktest).toHaveBeenCalledWith(secondRun.id);
    expect(await screen.findByText("0 runs")).toBeInTheDocument();
  });

  it("uses the selected MT5 symbol lot limits", async () => {
    vi.mocked(apiClient.getSymbols).mockResolvedValueOnce([
      {
        id: "symbol-1",
        name: "EURUSD",
        description: "Euro",
        digits: 5,
        is_active: true,
        volume_min: "0.01",
        volume_step: "0.01",
        volume_max: "100",
        contract_size: "100000",
      },
      {
        id: "sp500",
        name: "SP500",
        description: "S&P 500",
        digits: 1,
        is_active: true,
        volume_min: "0.1",
        volume_step: "0.1",
        volume_max: "100",
        contract_size: "50",
      },
    ]);

    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "Run configuration" });
    fireEvent.change(screen.getByLabelText("Instrument"), { target: { value: "sp500" } });

    const positionSize = screen.getByLabelText("Position size / lots");
    expect(positionSize).toHaveValue(0.1);
    expect(positionSize).toHaveAttribute("min", "0.1");
    expect(positionSize).toHaveAttribute("step", "0.1");
    expect(positionSize).toHaveAttribute("max", "99");
    expect(screen.getByText("Min 0.1 · step 0.1 · max 99 lots")).toBeInTheDocument();
  });

  it("shows candle loading on the disabled run button", async () => {
    let resolveJob!: (job: Awaited<ReturnType<typeof apiClient.startBacktestJob>>) => void;
    vi.mocked(apiClient.startBacktestJob).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveJob = resolve;
      }),
    );

    render(<StrategiesPage />);
    await screen.findByRole("heading", { name: "Run configuration" });
    fireEvent.click(screen.getByRole("button", { name: "Run backtesting" }));

    expect(await screen.findByRole("button", { name: "Loading historical candles" })).toBeDisabled();
    await act(async () => {
      resolveJob({
        id: "job-stopped",
        state: "stopped",
        stage: "stopped",
        progress_pct: "0",
        processed_candles: 0,
        total_candles: 0,
        result_id: null,
        error: null,
      });
    });
    expect(await screen.findByRole("button", { name: "Run backtesting" })).toBeEnabled();
  });

  it("shows only trades returned for the selected research run", async () => {
    const firstTrade = { ...result.trades[0]!, open_price: "111.11111" };
    const secondTrade = { ...result.trades[0]!, open_price: "222.22222" };
    const secondResult: BacktestResultRecord = {
      ...result,
      id: "run-2",
      created_at: "2026-01-02T08:00:00Z",
      trades: [secondTrade],
    };
    vi.mocked(apiClient.getBacktestRuns).mockResolvedValue([
      {
        id: result.id,
        created_at: result.created_at,
        symbol_id: result.symbol_id,
        timeframe: result.timeframe,
        strategy_name: result.strategy_name,
        strategy_version: result.strategy_version,
        data_start: result.data_start,
        data_end: result.data_end,
        total_trades: 1,
        final_balance: "10001",
        return_pct: "0.01",
      },
      {
        id: secondResult.id,
        created_at: secondResult.created_at,
        symbol_id: secondResult.symbol_id,
        timeframe: secondResult.timeframe,
        strategy_name: secondResult.strategy_name,
        strategy_version: secondResult.strategy_version,
        data_start: secondResult.data_start,
        data_end: secondResult.data_end,
        total_trades: 1,
        final_balance: "10001",
        return_pct: "0.01",
      },
    ]);
    vi.mocked(apiClient.getBacktestResult).mockImplementation(async (runId) =>
      runId === result.id
        ? { ...result, trades: [secondTrade] }
        : { ...secondResult, trades: [firstTrade] },
    );
    vi.mocked(apiClient.getBacktestTrades).mockImplementation(async (runId) =>
      runId === result.id ? [firstTrade] : [secondTrade],
    );

    render(<StrategiesPage />);

    let openCharts = await screen.findAllByRole("button", {
      name: /Open history and trade chart/,
    });
    fireEvent.click(openCharts[0]!);
    expect(await screen.findByText("111.11111")).toBeInTheDocument();
    expect(screen.queryByText("222.22222")).not.toBeInTheDocument();

    openCharts = screen.getAllByRole("button", {
      name: /Open history and trade chart/,
    });
    fireEvent.click(openCharts[1]!);
    expect(await screen.findByText("222.22222")).toBeInTheDocument();
    expect(screen.queryByText("111.11111")).not.toBeInTheDocument();
    expect(apiClient.getBacktestTrades).toHaveBeenCalledWith(result.id);
    expect(apiClient.getBacktestTrades).toHaveBeenCalledWith(secondResult.id);
  });

  it("localizes the date controls from the stored locale", async () => {
    window.localStorage.setItem("montecarlo.locale.v1", "ru");

    render(
      <I18nProvider>
        <StrategiesPage />
      </I18nProvider>,
    );

    const from = await screen.findByLabelText("От");
    expect(from).toHaveAttribute("lang", "ru-RU");
    expect(screen.getByLabelText("До")).toHaveAttribute("lang", "ru-RU");
    expect(screen.getByLabelText("Стартовый капитал")).toHaveAttribute("step", "100");
    expect(document.documentElement.lang).toBe("ru-RU");

    const localizedValue = new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date((from as HTMLInputElement).value));
    expect(screen.getByText(localizedValue)).toBeInTheDocument();
  });
});
