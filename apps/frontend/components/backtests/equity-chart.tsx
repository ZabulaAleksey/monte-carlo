import type { EquityPointRecord, VirtualTradeRecord } from "@/lib/api/types";
import { buildEquityPath, formatMoney } from "@/lib/backtests";
import { useI18n } from "@/lib/i18n";

interface EquityChartProps {
  points: EquityPointRecord[];
  trades: VirtualTradeRecord[];
}

const WIDTH = 900;
const HEIGHT = 260;
const PADDING = 28;

export function EquityChart({ points, trades }: EquityChartProps): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  if (points.length === 0) {
    return <div className="chart-empty">{t("equity.empty")}</div>;
  }
  const path = buildEquityPath(points, WIDTH, HEIGHT, PADDING);
  const values = points.map((point) => Number(point.equity));
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const coordinate = (index: number): { x: number; y: number } => ({
    x: PADDING + (index / Math.max(points.length - 1, 1)) * (WIDTH - PADDING * 2),
    y: PADDING + ((maximum - Number(points[index]?.equity ?? maximum)) / range)
      * (HEIGHT - PADDING * 2),
  });
  const operationMarkers = trades.map((trade) => {
    const closedAt = new Date(trade.closed_at).getTime();
    const index = points.findIndex(
      (point) => new Date(point.timestamp).getTime() >= closedAt,
    );
    return {
      trade,
      ...coordinate(index >= 0 ? index : points.length - 1),
    };
  });

  return (
    <div className="chart-frame">
      <div className="chart-caption">
        <span>{t("equity.low", { value: formatMoney(minimum, intlLocale) })}</span>
        <strong>{t("equity.operations", { count: trades.length })}</strong>
        <span>{t("equity.high", { value: formatMoney(maximum, intlLocale) })}</span>
      </div>
      <svg
        aria-label={`Equity curve with ${points.length} observations and ${trades.length} completed operations`}
        className="equity-chart"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <defs>
          <linearGradient id="equity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#175c45" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#175c45" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="equity-area"
          d={`${path} L ${WIDTH - PADDING} ${HEIGHT - PADDING} L ${PADDING} ${HEIGHT - PADDING} Z`}
        />
        <path className="equity-line" d={path} />
        {operationMarkers.map(({ trade, x, y }) => (
          <circle
            className={`equity-operation ${Number(trade.net_profit) >= 0 ? "win" : "loss"}`}
            cx={x}
            cy={y}
            key={trade.sequence}
            r="4.5"
          >
            <title>{`#${trade.sequence} · ${formatMoney(trade.net_profit, intlLocale)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
