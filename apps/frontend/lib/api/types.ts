export interface SymbolRecord {
  id: string;
  name: string;
  description: string;
  digits: number;
  is_active: boolean;
}

export interface CandleRecord {
  id: string;
  symbol_id: string;
  timeframe: string;
  open_time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  source: "api" | "demo" | "mt5";
}

export interface AccountRecord {
  id: string;
  external_id: string;
  name: string;
  currency: string;
  balance: string;
  created_at: string;
}

export type TradeSide = "buy" | "sell";
export type TradeStatus = "open" | "closed" | "cancelled";

export interface TradeRecord {
  id: string;
  account_id: string;
  symbol_id: string;
  external_id: string;
  side: TradeSide;
  volume: string;
  open_price: string;
  close_price: string | null;
  opened_at: string;
  closed_at: string | null;
  profit: string;
  commission: string;
  swap: string;
  status: TradeStatus;
}

export interface ApiInfo {
  name: string;
  version: string;
  environment: string;
}

export interface Mt5TerminalStatus {
  terminal_id: string;
  terminal_name: string;
  terminal_build: number;
  last_heartbeat_at: string | null;
  terminal_time: string | null;
  last_sync_at: string | null;
}

export interface Mt5Status {
  configured: boolean;
  connected: boolean;
  stale: boolean;
  stale_after_seconds: number;
  terminal: Mt5TerminalStatus | null;
}
