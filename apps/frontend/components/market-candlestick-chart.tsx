import type { CandleRecord, QuoteRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

interface MarketCandlestickChartProps {
  candles: CandleRecord[];
  quote: QuoteRecord | null;
  symbol: string;
  digits: number;
}

const WIDTH = 760;
const HEIGHT = 290;
const PLOT = { top: 18, right: 76, bottom: 28, left: 14 };

export function MarketCandlestickChart({
  candles,
  quote,
  symbol,
  digits,
}: MarketCandlestickChartProps): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const visible = [...candles]
    .sort((left, right) => Date.parse(left.open_time) - Date.parse(right.open_time))
    .slice(-48);
  if (visible.length === 0) {
    return <div className="panel-empty">{t("dashboard.chartEmpty")}</div>;
  }

  const prices = visible.flatMap((candle) => [Number(candle.low), Number(candle.high)]);
  if (quote) prices.push(Number(quote.bid), Number(quote.ask));
  const rawMinimum = Math.min(...prices);
  const rawMaximum = Math.max(...prices);
  const padding = (rawMaximum - rawMinimum || Math.abs(rawMaximum) * 0.001 || 1) * 0.08;
  const minimum = rawMinimum - padding;
  const maximum = rawMaximum + padding;
  const range = maximum - minimum;
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const step = plotWidth / visible.length;
  const candleWidth = Math.max(3, Math.min(10, step * 0.58));
  const x = (index: number): number => PLOT.left + step * index + step / 2;
  const y = (price: number): number =>
    PLOT.top + ((maximum - price) / range) * plotHeight;
  const levels = Array.from({ length: 5 }, (_, index) => maximum - (range * index) / 4);
  const quoteLines = quote
    ? [
        { label: "ASK", price: Number(quote.ask), className: "ask" },
        { label: "BID", price: Number(quote.bid), className: "bid" },
      ]
    : [];
  const labelIndexes = [
    ...new Set([0, Math.floor((visible.length - 1) / 2), visible.length - 1]),
  ];

  return (
    <div className="market-chart-frame">
      <svg
        aria-label={t("dashboard.chartAria", { symbol, count: visible.length })}
        className="market-candlestick-chart"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        {levels.map((level) => (
          <g className="market-grid-line" key={level}>
            <line
              x1={PLOT.left}
              x2={WIDTH - PLOT.right}
              y1={y(level)}
              y2={y(level)}
            />
            <text x={WIDTH - PLOT.right + 8} y={y(level) + 3}>
              {level.toFixed(digits)}
            </text>
          </g>
        ))}
        {visible.map((candle, index) => {
          const open = Number(candle.open);
          const close = Number(candle.close);
          const top = y(Math.max(open, close));
          const bodyHeight = Math.max(Math.abs(y(open) - y(close)), 1.5);
          const direction = close >= open ? "up" : "down";
          return (
            <g className={`market-candle ${direction}`} key={candle.id}>
              <title>
                {t("dashboard.candleTooltip", {
                  time: new Date(candle.open_time).toLocaleString(intlLocale),
                  open: candle.open,
                  high: candle.high,
                  low: candle.low,
                  close: candle.close,
                })}
              </title>
              <line
                x1={x(index)}
                x2={x(index)}
                y1={y(Number(candle.high))}
                y2={y(Number(candle.low))}
              />
              <rect
                height={bodyHeight}
                width={candleWidth}
                x={x(index) - candleWidth / 2}
                y={top}
              />
            </g>
          );
        })}
        {quoteLines.map((line) => (
          <g className={`live-price-line ${line.className}`} key={line.label}>
            <line
              x1={PLOT.left}
              x2={WIDTH - PLOT.right}
              y1={y(line.price)}
              y2={y(line.price)}
            />
            <text x={WIDTH - PLOT.right + 8} y={y(line.price) + 3}>
              {line.label}
            </text>
          </g>
        ))}
        {labelIndexes.map((index) => (
          <text
            className="market-time-label"
            key={index}
            textAnchor={index === 0 ? "start" : index === visible.length - 1 ? "end" : "middle"}
            x={x(index)}
            y={HEIGHT - 7}
          >
            {new Date(visible[index]?.open_time ?? "").toLocaleTimeString(intlLocale, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </text>
        ))}
      </svg>
    </div>
  );
}
