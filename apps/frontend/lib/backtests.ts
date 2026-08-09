import type {
  CandleRecord,
  EquityPointRecord,
  VirtualTradeRecord,
} from "@/lib/api/types";

export interface TradeMarker {
  candleIndex: number;
  kind: "entry" | "exit";
  side: "buy" | "sell";
  tradeSequence: number;
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

  return trades.flatMap((trade) => {
    const entryIndex = findIndex(trade.opened_at);
    const exitIndex = findIndex(
      trade.closed_at,
      ["stop_loss", "take_profit", "end_of_data"].includes(trade.exit_reason),
    );
    const markers: TradeMarker[] = [];
    if (entryIndex >= 0) {
      markers.push({
        candleIndex: entryIndex,
        kind: "entry",
        side: trade.side,
        tradeSequence: trade.sequence,
      });
    }
    if (exitIndex >= 0) {
      markers.push({
        candleIndex: exitIndex,
        kind: "exit",
        side: trade.side,
        tradeSequence: trade.sequence,
      });
    }
    return markers;
  });
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

export function formatMoney(value: string | number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatPercent(value: string | number): string {
  return `${Number(value).toFixed(2)}%`;
}
