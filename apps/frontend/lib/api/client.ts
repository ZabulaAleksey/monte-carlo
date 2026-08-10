import type {
  AccountRecord,
  ApiInfo,
  BacktestCreateRequest,
  BacktestJobRecord,
  BacktestResultRecord,
  BacktestRunSummary,
  CandleQuery,
  CandleRecord,
  Mt5Status,
  QuoteRecord,
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
  if (response.status === 204) return undefined as T;
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
    if (options.source) parameters.set("source", options.source);
    return request<CandleRecord[]>(`/api/v1/candles?${parameters.toString()}`);
  },
  getAccounts: (): Promise<AccountRecord[]> => request<AccountRecord[]>("/api/v1/accounts"),
  getTrades: (limit = 100, accountId?: string): Promise<TradeRecord[]> => {
    const parameters = new URLSearchParams({ limit: String(limit) });
    if (accountId) parameters.set("account_id", accountId);
    return request<TradeRecord[]>(`/api/v1/trades?${parameters.toString()}`);
  },
  getMt5Status: (): Promise<Mt5Status> =>
    request<Mt5Status>("/api/v1/mt5/status"),
  getQuotes: (symbolId?: string): Promise<QuoteRecord[]> => {
    const suffix = symbolId ? `?symbol_id=${encodeURIComponent(symbolId)}` : "";
    return request<QuoteRecord[]>(`/api/v1/quotes${suffix}`);
  },
  getBacktestStrategies: (): Promise<StrategyDefinition[]> =>
    request<StrategyDefinition[]>("/api/v1/backtests/strategies"),
  createBacktest: (payload: BacktestCreateRequest): Promise<BacktestResultRecord> =>
    request<BacktestResultRecord>("/api/v1/backtests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  startBacktestJob: (payload: BacktestCreateRequest): Promise<BacktestJobRecord> =>
    request<BacktestJobRecord>("/api/v1/backtests/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getBacktestJob: (jobId: string): Promise<BacktestJobRecord> =>
    request<BacktestJobRecord>(`/api/v1/backtests/jobs/${jobId}`),
  pauseBacktestJob: (jobId: string): Promise<BacktestJobRecord> =>
    request<BacktestJobRecord>(`/api/v1/backtests/jobs/${jobId}/pause`, {
      method: "POST",
    }),
  resumeBacktestJob: (jobId: string): Promise<BacktestJobRecord> =>
    request<BacktestJobRecord>(`/api/v1/backtests/jobs/${jobId}/resume`, {
      method: "POST",
    }),
  stopBacktestJob: (jobId: string): Promise<BacktestJobRecord> =>
    request<BacktestJobRecord>(`/api/v1/backtests/jobs/${jobId}/stop`, {
      method: "POST",
    }),
  getBacktestRuns: (): Promise<BacktestRunSummary[]> =>
    request<BacktestRunSummary[]>("/api/v1/backtests"),
  getBacktestResult: (runId: string): Promise<BacktestResultRecord> =>
    request<BacktestResultRecord>(`/api/v1/backtests/${runId}`),
  getBacktestTrades: (runId: string): Promise<BacktestResultRecord["trades"]> =>
    request<BacktestResultRecord["trades"]>(`/api/v1/backtests/${runId}/trades`),
  deleteBacktest: (runId: string): Promise<void> =>
    request<void>(`/api/v1/backtests/${runId}`, { method: "DELETE" }),
};

export { API_URL };
