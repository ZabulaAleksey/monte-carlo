import type { EquityPointRecord } from "@/lib/api/types";
import { buildEquityPath, formatMoney } from "@/lib/backtests";

interface EquityChartProps {
  points: EquityPointRecord[];
}

const WIDTH = 900;
const HEIGHT = 260;
const PADDING = 28;

export function EquityChart({ points }: EquityChartProps): React.JSX.Element {
  if (points.length === 0) {
    return <div className="chart-empty">No equity points were produced.</div>;
  }
  const path = buildEquityPath(points, WIDTH, HEIGHT, PADDING);
  const values = points.map((point) => Number(point.equity));
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);

  return (
    <div className="chart-frame">
      <div className="chart-caption">
        <span>Low {formatMoney(minimum)}</span>
        <span>High {formatMoney(maximum)}</span>
      </div>
      <svg
        aria-label={`Equity curve with ${points.length} observations`}
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
      </svg>
    </div>
  );
}
