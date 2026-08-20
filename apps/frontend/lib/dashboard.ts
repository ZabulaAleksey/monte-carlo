import type {
  AccountRecord,
  CandleRecord,
  QuoteRecord,
  SymbolRecord,
  TradeRecord,
} from "./api/types";

export interface DashboardSnapshot {
  accounts: AccountRecord[];
  candles: CandleRecord[];
  quotes: QuoteRecord[];
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

export const MARKET_TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"] as const;

const CURRENCY_CODES = new Set(
  (
    "AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND " +
    "BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNH CNY " +
    "COP COU CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP " +
    "GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK " +
    "JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL " +
    "LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD " +
    "NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF " +
    "SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS " +
    "TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES " +
    "VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWL"
  ).split(" "),
);

export function isCurrencyPairSymbol(name: string): boolean {
  const normalized = name.toUpperCase().replace(/[^A-Z]/g, "");
  for (let index = 0; index <= normalized.length - 6; index += 1) {
    const candidate = normalized.slice(index, index + 6);
    if (
      CURRENCY_CODES.has(candidate.slice(0, 3)) &&
      CURRENCY_CODES.has(candidate.slice(3))
    ) {
      return true;
    }
  }
  return false;
}

export function isDemoAccount(account: AccountRecord): boolean {
  return account.external_id.toUpperCase().startsWith("DEMO-");
}

export function selectPortfolioAccount(
  accounts: AccountRecord[],
  preferredExternalId?: string | null,
): AccountRecord | null {
  const newestFirst = [...accounts].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );
  const preferred = preferredExternalId
    ? newestFirst.find((account) => account.external_id === preferredExternalId)
    : null;
  if (preferred) return preferred;
  return newestFirst.find((account) => !isDemoAccount(account)) ?? newestFirst[0] ?? null;
}

export function selectEnvironmentAccount(
  accounts: AccountRecord[],
  connected: boolean,
): AccountRecord | null {
  const newestFirst = [...accounts].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );
  return connected
    ? newestFirst.find((account) => !isDemoAccount(account)) ?? null
    : newestFirst.find(isDemoAccount) ?? null;
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

export interface PortfolioMetrics {
  closedTrades: number;
  realizedNetProfit: number;
  winRate: number;
}

export function calculatePortfolioMetrics(trades: TradeRecord[]): PortfolioMetrics {
  const closed = trades.filter((trade) => trade.status === "closed");
  let realizedNetProfit = 0;
  let winners = 0;
  for (const trade of closed) {
    const net = Number(trade.profit) + Number(trade.commission) + Number(trade.swap);
    realizedNetProfit += net;
    if (net > 0) winners += 1;
  }
  return {
    closedTrades: closed.length,
    realizedNetProfit,
    winRate: closed.length ? (winners / closed.length) * 100 : 0,
  };
}

export function selectSourceCandles(
  candles: CandleRecord[],
  source: DashboardSource,
): CandleRecord[] {
  if (source === "mt5") return candles.filter((candle) => candle.source === "mt5");
  if (source === "demo") return candles.filter((candle) => candle.source === "demo");
  return candles.filter((candle) => candle.source === "api");
}

export function selectSourceQuotes(
  quotes: QuoteRecord[],
  source: DashboardSource,
): QuoteRecord[] {
  if (source === "mt5") return quotes.filter((quote) => quote.source === "mt5");
  if (source === "demo") return quotes.filter((quote) => quote.source === "demo");
  return quotes.filter((quote) => quote.source === "api");
}

const TIMEFRAME_MILLISECONDS: Record<string, number> = {
  M1: 60_000,
  M5: 5 * 60_000,
  M15: 15 * 60_000,
  M30: 30 * 60_000,
  H1: 60 * 60_000,
  H4: 4 * 60 * 60_000,
  D1: 24 * 60 * 60_000,
};

function decimalPlaces(value: string): number {
  return value.includes(".") ? value.length - value.indexOf(".") - 1 : 0;
}

function quoteMid(quote: QuoteRecord): string {
  const precision = Math.max(decimalPlaces(quote.bid), decimalPlaces(quote.ask));
  return ((Number(quote.bid) + Number(quote.ask)) / 2).toFixed(precision);
}

function candleKey(candle: CandleRecord): string {
  return `${candle.symbol_id}:${candle.timeframe}:${candle.open_time}`;
}

export function mergeLiveQuotes(
  candles: CandleRecord[],
  quotes: QuoteRecord[],
): CandleRecord[] {
  const byKey = new Map(candles.map((candle) => [candleKey(candle), candle]));
  const timeframesBySymbol = new Map<string, Set<string>>();
  for (const candle of candles) {
    if (candle.source !== quotes.find((quote) => quote.symbol_id === candle.symbol_id)?.source) {
      continue;
    }
    const timeframes = timeframesBySymbol.get(candle.symbol_id) ?? new Set<string>();
    timeframes.add(candle.timeframe);
    timeframesBySymbol.set(candle.symbol_id, timeframes);
  }

  for (const quote of quotes) {
    for (const timeframe of timeframesBySymbol.get(quote.symbol_id) ?? []) {
      const duration = TIMEFRAME_MILLISECONDS[timeframe.toUpperCase()];
      if (!duration) continue;
      const observed = Date.parse(quote.observed_at);
      if (!Number.isFinite(observed)) continue;
      const bucketTime = new Date(Math.floor(observed / duration) * duration).toISOString();
      const relevant = [...byKey.values()].filter(
        (candle) =>
          candle.symbol_id === quote.symbol_id &&
          candle.timeframe === timeframe &&
          candle.source === quote.source,
      );
      const latestTime = Math.max(
        ...relevant.map((candle) => Date.parse(candle.open_time)),
        Number.NEGATIVE_INFINITY,
      );
      if (Date.parse(bucketTime) < latestTime) continue;

      const key = `${quote.symbol_id}:${timeframe}:${bucketTime}`;
      const existing = byKey.get(key);
      const mid = quoteMid(quote);
      const open = existing?.open ?? relevant[0]?.close ?? mid;
      byKey.set(key, {
        id: existing?.id ?? `live:${key}`,
        symbol_id: quote.symbol_id,
        timeframe,
        open_time: bucketTime,
        open,
        high: String(Math.max(Number(existing?.high ?? open), Number(mid))),
        low: String(Math.min(Number(existing?.low ?? open), Number(mid))),
        close: mid,
        volume: existing?.volume ?? "0",
        source: quote.source,
      });
    }
  }

  return [...byKey.values()];
}

export function mergeDashboardSnapshot(
  previous: DashboardSnapshot | null,
  next: DashboardSnapshot,
): DashboardSnapshot {
  const retainedLive = previous?.candles.filter((candle) => candle.id.startsWith("live:")) ?? [];
  const merged = new Map(
    [...retainedLive, ...next.candles].map((candle) => [candleKey(candle), candle]),
  );
  return {
    ...next,
    candles: mergeLiveQuotes([...merged.values()], next.quotes),
  };
}

export function buildMarketSeries(
  candles: CandleRecord[],
  symbols: SymbolRecord[],
  preferredSymbolIds: string[] = [],
  quotes: QuoteRecord[] = [],
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

  const series = [...grouped.entries()]
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
    });
  const seriesKeys = new Set(series.map((item) => item.key));
  const quotedSymbolIds = new Set(quotes.map((quote) => quote.symbol_id));

  for (const symbol of symbols) {
    if (
      symbol.is_active &&
      quotedSymbolIds.has(symbol.id) &&
      isCurrencyPairSymbol(symbol.name)
    ) {
      for (const timeframe of MARKET_TIMEFRAMES) {
        const key = `${symbol.id}:${timeframe}`;
        if (!seriesKeys.has(key)) {
          series.push({ candles: [], key, symbol, timeframe });
          seriesKeys.add(key);
        }
      }
    }
  }

  return series.sort((left, right) => {
      const leftPriority = preferredOrder.get(left.symbol.id) ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = preferredOrder.get(right.symbol.id) ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      const leftTime = Date.parse(left.candles[0]?.open_time ?? "") || 0;
      const rightTime = Date.parse(right.candles[0]?.open_time ?? "") || 0;
      if (leftTime !== rightTime) return rightTime - leftTime;
      return left.symbol.name.localeCompare(right.symbol.name);
    });
}
