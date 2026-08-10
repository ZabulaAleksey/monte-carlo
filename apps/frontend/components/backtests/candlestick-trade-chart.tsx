import type { CandleRecord, VirtualTradeRecord } from "@/lib/api/types";
import { mapTradesToCandles, sortCandles } from "@/lib/backtests";
import { useI18n } from "@/lib/i18n";

interface CandlestickTradeChartProps {
  candles: CandleRecord[];
  trades: VirtualTradeRecord[];
  visibleUntil?: string;
}

const MINIMUM_WIDTH = 900;
const HEIGHT = 320;
const PADDING = 30;

export function CandlestickTradeChart({
  candles,
  trades,
  visibleUntil,
}: CandlestickTradeChartProps): React.JSX.Element {
  const { t } = useI18n();
  const visible = sortCandles(candles);
  if (visible.length === 0) {
    return <div className="chart-empty">{t("replay.empty")}</div>;
  }
  const lows = visible.map((item) => Number(item.low));
  const highs = visible.map((item) => Number(item.high));
  const minimum = Math.min(...lows);
  const maximum = Math.max(...highs);
  const range = maximum - minimum || 1;
  const plotHeight = HEIGHT - PADDING * 2;
  const width = Math.max(MINIMUM_WIDTH, visible.length * 7 + PADDING * 2);
  const step = (width - PADDING * 2) / visible.length;
  const candleWidth = Math.max(Math.min(step * 0.55, 9), 2);
  const y = (price: number): number =>
    PADDING + ((maximum - price) / range) * plotHeight;
  const x = (index: number): number => PADDING + step * index + step / 2;
  const markers = mapTradesToCandles(visible, trades, visibleUntil);

  return (
    <div className="chart-frame">
      <div className="chart-caption">
        <span>{t("replay.candles", { count: visible.length })}</span>
        <span>{t("replay.markers")}</span>
      </div>
      <svg
        aria-label={`Candlestick chart with ${trades.length} virtual trades`}
        className="candlestick-chart"
        role="img"
        style={{ minWidth: `${width}px` }}
        viewBox={`0 0 ${width} ${HEIGHT}`}
      >
        {visible.map((item, index) => {
          const open = Number(item.open);
          const close = Number(item.close);
          const top = y(Math.max(open, close));
          const bodyHeight = Math.max(Math.abs(y(open) - y(close)), 1.5);
          const direction = close >= open ? "up" : "down";
          return (
            <g className={`candle ${direction}`} key={item.id}>
              <title>
                {`${new Date(item.open_time).toLocaleString()}: O ${item.open}, H ${item.high}, L ${item.low}, C ${item.close}`}
              </title>
              <line x1={x(index)} x2={x(index)} y1={y(Number(item.high))} y2={y(Number(item.low))} />
              <rect
                height={bodyHeight}
                width={candleWidth}
                x={x(index) - candleWidth / 2}
                y={top}
              />
            </g>
          );
        })}
        {markers.map((marker) => {
          const item = visible[marker.candleIndex];
          if (!item) return null;
          const markerX = x(marker.candleIndex);
          const isEntry = marker.kind === "entry";
          const markerY = isEntry ? y(Number(item.low)) + 13 : y(Number(item.high)) - 13;
          const className = `trade-marker ${marker.side} ${marker.kind}`;
          return isEntry ? (
            <polygon
              aria-label={`Trade ${marker.tradeSequence} ${marker.side} entry`}
              className={className}
              key={`${marker.tradeSequence}-entry`}
              points={`${markerX},${markerY - 6} ${markerX - 6},${markerY + 5} ${markerX + 6},${markerY + 5}`}
            />
          ) : (
            <circle
              aria-label={`Trade ${marker.tradeSequence} exit`}
              className={className}
              cx={markerX}
              cy={markerY}
              key={`${marker.tradeSequence}-exit`}
              r="5"
            />
          );
        })}
      </svg>
    </div>
  );
}
