export interface SymbolRecord {
  id: string;
  name: string;
  description: string;
  digits: number;
  is_active: boolean;
  volume_min: string;
  volume_step: string;
  volume_max: string;
  contract_size: string;
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

export interface QuoteRecord {
  symbol_id: string;
  terminal_id: string;
  bid: string;
  ask: string;
  observed_at: string;
  received_at: string;
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

export interface PositionRecord {
  id: string;
  account_id: string;
  symbol_id: string;
  external_id: string;
  side: TradeSide;
  volume: string;
  open_price: string;
  current_price: string;
  stop_loss: string | null;
  take_profit: string | null;
  profit: string;
  swap: string;
  opened_at: string;
  observed_at: string;
  status: "open";
}

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
  account_external_id?: string | null;
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

export type BacktestExitReason =
  | "signal"
  | "reverse"
  | "stop_loss"
  | "take_profit"
  | "end_of_data";

export interface StrategyParameterDefinition {
  name: string;
  label: string;
  value_type: "integer" | "decimal";
  default: number;
  minimum: number | null;
  maximum: number | null;
}

export interface StrategyDefinition {
  name: string;
  version: string;
  title: string;
  description: string;
  parameters: StrategyParameterDefinition[];
}

export interface BacktestCreateRequest {
  strategy_name: string;
  symbol_id: string;
  timeframe: string;
  start_at: string;
  end_at: string;
  initial_capital: string;
  position_size?: string;
  stop_loss_pct?: string | null;
  take_profit_pct?: string | null;
  commission_pct_per_fill: string;
  swap_pct_per_lot_per_day: string;
  slippage_points: string;
  allow_partial_data?: boolean;
  parameters: Record<string, number | string>;
}

export type BacktestJobState =
  | "queued"
  | "loading_data"
  | "simulating"
  | "paused"
  | "completed"
  | "stopped"
  | "failed";

export interface BacktestJobRecord {
  id: string;
  state: BacktestJobState;
  stage: string;
  progress_pct: string;
  processed_candles: number;
  total_candles: number;
  result_id: string | null;
  error: string | null;
}

export interface BacktestSettingsRecord {
  initial_capital: string;
  position_size: string;
  contract_size: string;
  price_digits: number;
  stop_loss_pct: string | null;
  take_profit_pct: string | null;
  commission_pct_per_fill: string;
  swap_pct_per_lot_per_day: string;
  slippage_points: string;
}

export interface HistoricalDataIntervalRecord {
  start_at: string;
  end_at: string;
}

export interface HistoricalDataCoverageRecord {
  symbol_id: string;
  timeframe: string;
  requested_start: string;
  requested_end: string;
  candle_count: number;
  complete: boolean;
  cached_intervals: HistoricalDataIntervalRecord[];
  missing_intervals: HistoricalDataIntervalRecord[];
}

export type HistoricalDataRequestState =
  | "pending"
  | "claimed"
  | "completed"
  | "failed";

export interface HistoricalDataRequestRecord {
  id: string;
  symbol_id: string;
  symbol: string;
  timeframe: string;
  requested_start: string;
  requested_end: string;
  status: HistoricalDataRequestState;
  requested_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  terminal_id: string | null;
  candle_count: number;
  error: string | null;
}

export interface VirtualTradeRecord {
  sequence: number;
  side: TradeSide;
  volume: string;
  opened_at: string;
  closed_at: string;
  open_price: string;
  close_price: string;
  stop_loss: string | null;
  take_profit: string | null;
  exit_reason: BacktestExitReason;
  gross_profit: string;
  commission: string;
  swap: string;
  net_profit: string;
}

export interface EquityPointRecord {
  sequence: number;
  timestamp: string;
  balance: string;
  equity: string;
  drawdown_pct: string;
  drawdown_absolute: string;
}

export interface BacktestMetricsRecord {
  initial_capital: string;
  final_balance: string;
  final_equity: string;
  total_net_profit: string;
  return_pct: string;
  max_drawdown_pct: string;
  max_drawdown_absolute: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_pct: string;
  profit_factor: string | null;
  total_commission: string;
  total_swap: string;
}

export interface BacktestResultRecord {
  id: string;
  created_at: string;
  symbol_id: string;
  timeframe: string;
  requested_start: string;
  requested_end: string;
  data_start: string;
  data_end: string;
  candle_count: number;
  strategy_name: string;
  strategy_version: string;
  parameters: Record<string, unknown>;
  settings: BacktestSettingsRecord;
  trades: VirtualTradeRecord[];
  equity_curve: EquityPointRecord[];
  metrics: BacktestMetricsRecord;
  data_complete: boolean;
  warnings: string[];
}

export interface BacktestRunSummary {
  id: string;
  created_at: string;
  symbol_id: string;
  timeframe: string;
  strategy_name: string;
  strategy_version: string;
  data_start: string;
  data_end: string;
  total_trades: number;
  final_balance: string;
  return_pct: string;
}

export interface CandleQuery {
  limit?: number;
  symbolId?: string;
  timeframe?: string;
  startAt?: string;
  endAt?: string;
  source?: CandleRecord["source"];
}

export interface DatabaseTableStatsRecord {
  name: string;
  row_count: number;
}

export interface CandleDatasetStatsRecord {
  symbol_id: string;
  symbol: string;
  timeframe: string;
  source: string;
  candle_count: number;
  first_at: string;
  last_at: string;
}

export interface DatabaseOverviewRecord {
  connected: boolean;
  read_only: boolean;
  engine: string;
  database_name: string;
  server_version: string;
  schema_revision: string | null;
  database_size_bytes: number | null;
  server_time: string;
  tables: DatabaseTableStatsRecord[];
  candle_datasets: CandleDatasetStatsRecord[];
}
