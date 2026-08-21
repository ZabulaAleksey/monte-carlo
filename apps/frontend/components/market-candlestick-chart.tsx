import type { CandleRecord, QuoteRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import {
  buildMarketChartModel,
  MARKET_CHART_HEIGHT,
  MARKET_CHART_PLOT,
  MARKET_CHART_WIDTH,
} from "@/lib/market-chart";

interface MarketCandlestickChartProps {
  candles: CandleRecord[];
  quote: QuoteRecord | null;
  symbol: string;
  digits: number;
}

export function MarketCandlestickChart({
  candles,
  quote,
  symbol,
  digits,
}: MarketCandlestickChartProps): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const model = buildMarketChartModel(candles, quote);
  if (!model) {
    return <div className="panel-empty">{t("dashboard.chartEmpty")}</div>;
  }
  const { candleWidth, labelIndexes, levels, quoteLines, visible, x, y } = model;

  return (
    <div className="market-chart-frame">
      <svg
        aria-label={t("dashboard.chartAria", { symbol, count: visible.length })}
        className="market-candlestick-chart"
        role="img"
        viewBox={`0 0 ${MARKET_CHART_WIDTH} ${MARKET_CHART_HEIGHT}`}
      >
        {levels.map((level) => (
          <g className="market-grid-line" key={level}>
            <line
              x1={MARKET_CHART_PLOT.left}
              x2={MARKET_CHART_WIDTH - MARKET_CHART_PLOT.right}
              y1={y(level)}
              y2={y(level)}
            />
            <text x={MARKET_CHART_WIDTH - MARKET_CHART_PLOT.right + 8} y={y(level) + 3}>
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
              x1={MARKET_CHART_PLOT.left}
              x2={MARKET_CHART_WIDTH - MARKET_CHART_PLOT.right}
              y1={y(line.price)}
              y2={y(line.price)}
            />
            <text x={MARKET_CHART_WIDTH - MARKET_CHART_PLOT.right + 8} y={y(line.price) + 3}>
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
            y={MARKET_CHART_HEIGHT - 7}
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
