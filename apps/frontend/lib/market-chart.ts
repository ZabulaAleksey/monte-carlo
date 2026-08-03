import type { CandlestickData, UTCTimestamp } from "lightweight-charts";

import type { CandleRecord } from "@/lib/api/types";

function parsePrice(value: string): number | null {
  const price = Number(value);
  return Number.isFinite(price) ? price : null;
}

function parseTime(value: string): UTCTimestamp | null {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return Math.floor(milliseconds / 1_000) as UTCTimestamp;
}

export function toCandlestickData(
  candles: CandleRecord[],
): CandlestickData<UTCTimestamp>[] {
  const byTime = new Map<UTCTimestamp, CandlestickData<UTCTimestamp>>();

  for (const candle of candles) {
    const time = parseTime(candle.open_time);
    const open = parsePrice(candle.open);
    const high = parsePrice(candle.high);
    const low = parsePrice(candle.low);
    const close = parsePrice(candle.close);

    if (time === null || open === null || high === null || low === null || close === null) {
      continue;
    }
    if (high < Math.max(open, close) || low > Math.min(open, close) || low > high) {
      continue;
    }

    byTime.set(time, { time, open, high, low, close });
  }

  return [...byTime.values()].sort((left, right) => Number(left.time) - Number(right.time));
}
