import type { CandleRecord, QuoteRecord } from "@/lib/api/types";

export const MARKET_CHART_WIDTH = 760;
export const MARKET_CHART_HEIGHT = 290;
export const MARKET_CHART_PLOT = { top: 18, right: 76, bottom: 28, left: 14 };

/** Build SVG-ready geometry without React or browser state. */
export function buildMarketChartModel(
  candles: CandleRecord[],
  quote: QuoteRecord | null,
) {
  const visible = [...candles]
    .sort((left, right) => Date.parse(left.open_time) - Date.parse(right.open_time))
    .slice(-48);
  if (visible.length === 0) return null;

  const prices = visible.flatMap((candle) => [Number(candle.low), Number(candle.high)]);
  if (quote) prices.push(Number(quote.bid), Number(quote.ask));
  const rawMinimum = Math.min(...prices);
  const rawMaximum = Math.max(...prices);
  const padding = (rawMaximum - rawMinimum || Math.abs(rawMaximum) * 0.001 || 1) * 0.08;
  const minimum = rawMinimum - padding;
  const maximum = rawMaximum + padding;
  const range = maximum - minimum;
  const plotWidth = MARKET_CHART_WIDTH - MARKET_CHART_PLOT.left - MARKET_CHART_PLOT.right;
  const plotHeight = MARKET_CHART_HEIGHT - MARKET_CHART_PLOT.top - MARKET_CHART_PLOT.bottom;
  const step = plotWidth / visible.length;
  const x = (index: number): number => MARKET_CHART_PLOT.left + step * index + step / 2;
  const y = (price: number): number =>
    MARKET_CHART_PLOT.top + ((maximum - price) / range) * plotHeight;

  return {
    candleWidth: Math.max(3, Math.min(10, step * 0.58)),
    labelIndexes: [...new Set([0, Math.floor((visible.length - 1) / 2), visible.length - 1])],
    levels: Array.from({ length: 5 }, (_, index) => maximum - (range * index) / 4),
    quoteLines: quote
      ? [
          { label: "ASK", price: Number(quote.ask), className: "ask" },
          { label: "BID", price: Number(quote.bid), className: "bid" },
        ]
      : [],
    visible,
    x,
    y,
  };
}
