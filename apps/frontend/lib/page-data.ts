import { apiClient } from "./api/client";
import type {
  AccountRecord,
  CandleRecord,
  Mt5Status,
  SymbolRecord,
  TradeRecord,
} from "./api/types";

export interface EnvironmentData {
  accounts: AccountRecord[];
  mt5: Mt5Status;
}

export interface MarketDataPageData extends EnvironmentData {
  candles: CandleRecord[];
  symbols: SymbolRecord[];
}

export interface TradesPageData extends EnvironmentData {
  symbols: SymbolRecord[];
  trades: TradeRecord[];
}

export async function loadEnvironmentData(): Promise<EnvironmentData> {
  const [accounts, mt5] = await Promise.all([
    apiClient.getAccounts(),
    apiClient.getMt5Status(),
  ]);
  return { accounts, mt5 };
}

export async function loadMarketDataPageData(): Promise<MarketDataPageData> {
  const [accounts, candles, symbols, mt5] = await Promise.all([
    apiClient.getAccounts(),
    apiClient.getCandles(500),
    apiClient.getSymbols(),
    apiClient.getMt5Status(),
  ]);
  return { accounts, candles, symbols, mt5 };
}

export async function loadTradesPageData(): Promise<TradesPageData> {
  const [accounts, symbols, trades, mt5] = await Promise.all([
    apiClient.getAccounts(),
    apiClient.getSymbols(),
    apiClient.getTrades(),
    apiClient.getMt5Status(),
  ]);
  return { accounts, symbols, trades, mt5 };
}
