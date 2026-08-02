import type {
  AccountRecord,
  ApiInfo,
  CandleRecord,
  Mt5Status,
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
  getCandles: (limit = 48): Promise<CandleRecord[]> =>
    request<CandleRecord[]>(`/api/v1/candles?limit=${limit}`),
  getAccounts: (): Promise<AccountRecord[]> => request<AccountRecord[]>("/api/v1/accounts"),
  getTrades: (limit = 100): Promise<TradeRecord[]> =>
    request<TradeRecord[]>(`/api/v1/trades?limit=${limit}`),
  getMt5Status: (): Promise<Mt5Status> =>
    request<Mt5Status>("/api/v1/mt5/status"),
};

export { API_URL };
