import type {
  CandleRecord,
  EquityPointRecord,
  VirtualTradeRecord,
} from "@/lib/api/types";

export interface TradeMarker {
  candleIndex: number;
  kind: "entry" | "exit";
  netProfit: number | null;
  side: "buy" | "sell";
  tradeSequence: number;
}

export interface PeriodSeparator {
  candleIndex: number;
  label: string;
}

export interface HistoricalYearInterval {
  endAt: string;
  startAt: string;
  year: number;
}

export function splitHistoricalIntervalByYear(
  startAt: string,
  endAt: string,
): HistoricalYearInterval[] {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.getTime() >= end.getTime()
  ) {
    return [];
  }

  const intervals: HistoricalYearInterval[] = [];
  let cursor = start;
  while (cursor.getTime() < end.getTime()) {
    const year = cursor.getUTCFullYear();
    const yearBoundary = new Date(Date.UTC(year + 1, 0, 1));
    const segmentEnd = yearBoundary.getTime() < end.getTime() ? yearBoundary : end;
    intervals.push({
      startAt: cursor.toISOString(),
      endAt: segmentEnd.toISOString(),
      year,
    });
    cursor = segmentEnd;
  }
  return intervals;
}

export function sortCandles(candles: CandleRecord[]): CandleRecord[] {
  return [...candles].sort(
    (left, right) =>
      new Date(left.open_time).getTime() - new Date(right.open_time).getTime(),
  );
}

export function sampleCandles(candles: CandleRecord[], maximum = 90): CandleRecord[] {
  const sorted = sortCandles(candles);
  if (sorted.length <= maximum) return sorted;
  if (maximum <= 1) return sorted.slice(0, 1);
  const result: CandleRecord[] = [];
  for (let index = 0; index < maximum; index += 1) {
    const sourceIndex = Math.round((index * (sorted.length - 1)) / (maximum - 1));
    const item = sorted[sourceIndex];
    if (item) result.push(item);
  }
  return result;
}

export function mapTradesToCandles(
  candles: CandleRecord[],
  trades: VirtualTradeRecord[],
  visibleUntil?: string,
): TradeMarker[] {
  const timestamps = candles.map((candle) => new Date(candle.open_time).getTime());
  const findIndex = (timestamp: string, previousAtBoundary = false): number => {
    const target = new Date(timestamp).getTime() - (previousAtBoundary ? 1 : 0);
    const firstTimestamp = timestamps[0];
    if (firstTimestamp === undefined || target < firstTimestamp) return -1;
    for (let index = timestamps.length - 1; index >= 0; index -= 1) {
      if ((timestamps[index] ?? Number.POSITIVE_INFINITY) <= target) return index;
    }
    return -1;
  };

  const cutoff = visibleUntil ? new Date(visibleUntil).getTime() : Number.POSITIVE_INFINITY;
  return trades.flatMap((trade) => {
    const entryIndex = findIndex(trade.opened_at);
    const exitIndex = findIndex(
      trade.closed_at,
      ["stop_loss", "take_profit", "bankruptcy", "end_of_data"].includes(
        trade.exit_reason,
      ),
    );
    const markers: TradeMarker[] = [];
    if (entryIndex >= 0 && new Date(trade.opened_at).getTime() < cutoff) {
      markers.push({
        candleIndex: entryIndex,
        kind: "entry",
        netProfit: null,
        side: trade.side,
        tradeSequence: trade.sequence,
      });
    }
    if (exitIndex >= 0 && new Date(trade.closed_at).getTime() < cutoff) {
      markers.push({
        candleIndex: exitIndex,
        kind: "exit",
        netProfit: Number(trade.net_profit),
        side: trade.side,
        tradeSequence: trade.sequence,
      });
    }
    return markers;
  });
}

export function buildPeriodSeparators(
  candles: CandleRecord[],
  locale = "en-US",
): PeriodSeparator[] {
  const sorted = sortCandles(candles);
  const timeframe = sorted[0]?.timeframe.toUpperCase() ?? "";
  const yearly = timeframe.startsWith("MN") || timeframe.endsWith("MO");
  const monthly =
    !yearly &&
    (timeframe.startsWith("W") ||
      timeframe.endsWith("W") ||
      timeframe.startsWith("D") ||
      timeframe.endsWith("D"));
  const keyFor = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    if (yearly) return String(year);
    if (monthly) return `${year}-${month}`;
    return `${year}-${month}-${day}`;
  };
  const labelFor = (date: Date): string => {
    if (yearly) return String(date.getUTCFullYear());
    return new Intl.DateTimeFormat(locale, {
      day: monthly ? undefined : "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  };
  const separators: PeriodSeparator[] = [];
  let previousKey = sorted[0] ? keyFor(new Date(sorted[0].open_time)) : "";
  for (let index = 1; index < sorted.length; index += 1) {
    const item = sorted[index];
    if (!item) continue;
    const date = new Date(item.open_time);
    const key = keyFor(date);
    if (key !== previousKey) {
      separators.push({ candleIndex: index, label: labelFor(date) });
      previousKey = key;
    }
  }
  return separators;
}

export function buildEquityPath(
  points: EquityPointRecord[],
  width: number,
  height: number,
  padding: number,
): string {
  if (points.length === 0) return "";
  const values = points.map((point) => Number(point.equity));
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  return values
    .map((value, index) => {
      const x =
        padding +
        (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y =
        padding + ((maximum - value) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function formatMoney(value: string | number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatPercent(value: string | number): string {
  return `${Number(value).toFixed(2)}%`;
}
