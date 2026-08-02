import type {
  AccountRecord,
  CandleRecord,
  Mt5Status,
  SymbolRecord,
  TradeRecord,
} from "./api/types";

export interface DashboardSnapshot {
  accounts: AccountRecord[];
  candles: CandleRecord[];
  mt5: Mt5Status;
  symbols: SymbolRecord[];
  trades: TradeRecord[];
}

export type DashboardSource = "mt5" | "demo" | "empty";

export interface MarketSeries {
  candles: CandleRecord[];
  key: string;
  symbol: SymbolRecord;
  timeframe: string;
}

export function isDemoAccount(account: AccountRecord): boolean {
  return account.external_id.toUpperCase().startsWith("DEMO-");
}

export function selectPortfolioAccount(accounts: AccountRecord[]): AccountRecord | null {
  const newestFirst = [...accounts].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );
  return newestFirst.find((account) => !isDemoAccount(account)) ?? newestFirst[0] ?? null;
}

export function getDashboardSource(account: AccountRecord | null): DashboardSource {
  if (!account) return "empty";
  return isDemoAccount(account) ? "demo" : "mt5";
}

export function selectAccountTrades(
  trades: TradeRecord[],
  account: AccountRecord | null,
): TradeRecord[] {
  if (!account) return [];
  return trades.filter((trade) => trade.account_id === account.id);
}

export function selectSourceCandles(
  candles: CandleRecord[],
  source: DashboardSource,
): CandleRecord[] {
  if (source === "mt5") return candles.filter((candle) => candle.source === "mt5");
  if (source === "demo") return candles.filter((candle) => candle.source === "demo");
  return candles.filter((candle) => candle.source === "api");
}

export function buildMarketSeries(
  candles: CandleRecord[],
  symbols: SymbolRecord[],
  preferredSymbolIds: string[] = [],
): MarketSeries[] {
  const symbolById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const grouped = new Map<string, CandleRecord[]>();

  for (const candle of candles) {
    const key = `${candle.symbol_id}:${candle.timeframe}`;
    const series = grouped.get(key) ?? [];
    series.push(candle);
    grouped.set(key, series);
  }

  const preferredOrder = new Map(
    preferredSymbolIds.map((symbolId, index) => [symbolId, index]),
  );

  return [...grouped.entries()]
    .flatMap(([key, records]) => {
      const symbol = symbolById.get(records[0]?.symbol_id ?? "");
      if (!symbol) return [];
      const sortedCandles = [...records].sort(
        (left, right) => Date.parse(right.open_time) - Date.parse(left.open_time),
      );
      return [{
        candles: sortedCandles,
        key,
        symbol,
        timeframe: sortedCandles[0]?.timeframe ?? "",
      }];
    })
    .sort((left, right) => {
      const leftPriority = preferredOrder.get(left.symbol.id) ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = preferredOrder.get(right.symbol.id) ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return Date.parse(right.candles[0]?.open_time ?? "") -
        Date.parse(left.candles[0]?.open_time ?? "");
    });
}
