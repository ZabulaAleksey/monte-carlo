import type { CandleRecord, QuoteRecord, SymbolRecord } from "@/lib/api/types";

export type SortDirection = "ascending" | "descending";
export type QuoteSortKey = "symbol" | "bid" | "ask" | "spread" | "updated";
export type CandleSortKey = "source" | "symbol" | "time" | "timeframe" | "open" | "high" | "low" | "close" | "volume";

export interface SortState<Key extends string> {
  direction: SortDirection;
  key: Key;
}

export interface QuoteRow {
  digits: number;
  quote: QuoteRecord;
  spread: number;
  symbolName: string;
}

export interface CandleRow {
  candle: CandleRecord;
  symbolName: string;
}

function compareValues(left: number | string, right: number | string): number {
  return typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

export function nextSort<Key extends string>(current: SortState<Key>, key: Key): SortState<Key> {
  return {
    key,
    direction: current.key === key && current.direction === "ascending" ? "descending" : "ascending",
  };
}

export function buildQuoteRows(quotes: QuoteRecord[], symbols: SymbolRecord[], sort: SortState<QuoteSortKey>): QuoteRow[] {
  const symbolById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  return quotes.map((quote) => {
    const symbol = symbolById.get(quote.symbol_id);
    const digits = symbol?.digits ?? 5;
    return {
      quote,
      symbolName: symbol?.name ?? "—",
      digits,
      spread: (Number(quote.ask) - Number(quote.bid)) * 10 ** digits,
    };
  }).sort((left, right) => {
    const value = (row: QuoteRow): number | string => ({
      symbol: row.symbolName,
      bid: Number(row.quote.bid),
      ask: Number(row.quote.ask),
      spread: row.spread,
      updated: Date.parse(row.quote.observed_at),
    })[sort.key];
    const stable = compareValues(value(left), value(right)) || left.symbolName.localeCompare(right.symbolName);
    return sort.direction === "ascending" ? stable : -stable;
  });
}

export function buildCandleRows(candles: CandleRecord[], symbols: SymbolRecord[], sort: SortState<CandleSortKey>): CandleRow[] {
  const symbolById = new Map(symbols.map((symbol) => [symbol.id, symbol.name]));
  return candles.map((candle) => ({
    candle,
    symbolName: symbolById.get(candle.symbol_id) ?? "—",
  })).sort((left, right) => {
    const value = (row: CandleRow): number | string => ({
      source: row.candle.source,
      symbol: row.symbolName,
      time: Date.parse(row.candle.open_time),
      timeframe: row.candle.timeframe,
      open: Number(row.candle.open),
      high: Number(row.candle.high),
      low: Number(row.candle.low),
      close: Number(row.candle.close),
      volume: Number(row.candle.volume),
    })[sort.key];
    const stable = compareValues(value(left), value(right)) || left.symbolName.localeCompare(right.symbolName);
    return sort.direction === "ascending" ? stable : -stable;
  });
}
