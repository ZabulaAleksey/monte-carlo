import type {
  AccountRecord,
  ApiInfo,
  BacktestCreateRequest,
  BacktestResultRecord,
  BacktestRunSummary,
  CandleQuery,
  CandleRecord,
  Mt5Status,
  StrategyDefinition,
  SymbolRecord,
  TradeRecord,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ErrorPayload {
  error?: { message?: string };
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiClientError("Backend is unavailable", 0);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
    throw new ApiClientError(payload.error?.message ?? "API request failed", response.status);
  }
  return (await response.json()) as T;
}

export const apiClient = {
  getInfo: (): Promise<ApiInfo> => request<ApiInfo>("/api/v1/info"),
  getSymbols: (): Promise<SymbolRecord[]> => request<SymbolRecord[]>("/api/v1/symbols"),
  getCandles: (query: number | CandleQuery = 48): Promise<CandleRecord[]> => {
    const options = typeof query === "number" ? { limit: query } : query;
    const parameters = new URLSearchParams();
    parameters.set("limit", String(options.limit ?? 200));
    if (options.symbolId) parameters.set("symbol_id", options.symbolId);
    if (options.timeframe) parameters.set("timeframe", options.timeframe);
    if (options.startAt) parameters.set("start_at", options.startAt);
    if (options.endAt) parameters.set("end_at", options.endAt);
    return request<CandleRecord[]>(`/api/v1/candles?${parameters.toString()}`);
  },
  getAccounts: (): Promise<AccountRecord[]> => request<AccountRecord[]>("/api/v1/accounts"),
  getTrades: (limit = 100): Promise<TradeRecord[]> =>
    request<TradeRecord[]>(`/api/v1/trades?limit=${limit}`),
  getMt5Status: (): Promise<Mt5Status> =>
    request<Mt5Status>("/api/v1/mt5/status"),
  getBacktestStrategies: (): Promise<StrategyDefinition[]> =>
    request<StrategyDefinition[]>("/api/v1/backtests/strategies"),
  createBacktest: (payload: BacktestCreateRequest): Promise<BacktestResultRecord> =>
    request<BacktestResultRecord>("/api/v1/backtests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getBacktestRuns: (): Promise<BacktestRunSummary[]> =>
    request<BacktestRunSummary[]>("/api/v1/backtests"),
  getBacktestResult: (runId: string): Promise<BacktestResultRecord> =>
    request<BacktestResultRecord>(`/api/v1/backtests/${runId}`),
  getBacktestTrades: (runId: string): Promise<BacktestResultRecord["trades"]> =>
    request<BacktestResultRecord["trades"]>(`/api/v1/backtests/${runId}/trades`),
};

export { API_URL };
