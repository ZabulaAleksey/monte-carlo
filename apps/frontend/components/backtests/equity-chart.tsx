import type { EquityPointRecord, VirtualTradeRecord } from "@/lib/api/types";
import { formatMoney } from "@/lib/backtests";
import { useI18n } from "@/lib/i18n";

interface EquityChartProps {
  points: EquityPointRecord[];
  trades: VirtualTradeRecord[];
}

const WIDTH = 900;
const HEIGHT = 300;
const PLOT = {
  bottom: HEIGHT - 52,
  left: 76,
  right: WIDTH - 68,
  top: 24,
} as const;

function seriesPath(
  values: number[],
  x: (index: number) => number,
  y: (value: number) => number,
): string {
  return values
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`,
    )
    .join(" ");
}

export function EquityChart({ points, trades }: EquityChartProps): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  if (points.length === 0) {
    return <div className="chart-empty">{t("equity.empty")}</div>;
  }

  const balanceValues = points.map((point) => Number(point.balance));
  const liquidationValues = points.map((point) => Number(point.equity));
  const equityMinimum = Math.min(...balanceValues, ...liquidationValues);
  const equityMaximum = Math.max(...balanceValues, ...liquidationValues);
  const drawdownValues = points.map((point) => Number(point.drawdown_absolute ?? 0));
  const minimum = equityMinimum;
  const maximum = equityMaximum;
  const valueRange = maximum - minimum || 1;
  const drawdownMaximum = Math.max(...drawdownValues);
  const plotWidth = PLOT.right - PLOT.left;
  const plotHeight = PLOT.bottom - PLOT.top;
  const x = (index: number): number =>
    PLOT.left + (index / Math.max(points.length - 1, 1)) * plotWidth;
  const valueY = (value: number): number =>
    PLOT.top + ((maximum - value) / valueRange) * plotHeight;
  const balancePath = seriesPath(balanceValues, x, valueY);
  const liquidationPath = seriesPath(liquidationValues, x, valueY);
  const valueTicks = [maximum, minimum + valueRange / 2, minimum];
  const xTickIndices = [
    ...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  ];
  const operationMarkers = trades.map((trade) => {
    const closedAt = new Date(trade.closed_at).getTime();
    const index = points.findIndex(
      (point) => new Date(point.timestamp).getTime() >= closedAt,
    );
    const resolvedIndex = index >= 0 ? index : points.length - 1;
    return {
      trade,
      x: x(resolvedIndex),
      y: valueY(balanceValues[resolvedIndex] ?? maximum),
    };
  });

  return (
    <div className="chart-frame">
      <div className="chart-caption">
        <span>{t("equity.low", { value: formatMoney(equityMinimum, intlLocale) })}</span>
        <div className="equity-legend">
          <span><i className="balance-swatch" />{t("equity.legendEquity")}</span>
          <span><i className="liquidation-swatch" />{t("equity.legendDrawdown")}</span>
        </div>
        <strong>{t("equity.operations", { count: trades.length })}</strong>
        <span>
          {t("equity.maxDrawdown", {
            value: formatMoney(drawdownMaximum, intlLocale),
          })}
        </span>
        <span>{t("equity.high", { value: formatMoney(equityMaximum, intlLocale) })}</span>
      </div>
      <svg
        aria-label={t("equity.aria", { points: points.length, trades: trades.length })}
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
        <g className="chart-grid">
          {valueTicks.map((value, index) => (
            <line
              key={`grid-${value}-${index}`}
              x1={PLOT.left}
              x2={PLOT.right}
              y1={valueY(value)}
              y2={valueY(value)}
            />
          ))}
        </g>
        <g className="equity-axis">
          {valueTicks.map((value, index) => (
            <text
              className="chart-axis-tick"
              key={`equity-${value}-${index}`}
              textAnchor="end"
              x={PLOT.left - 8}
              y={valueY(value) + 4}
            >
              {formatMoney(value, intlLocale)}
            </text>
          ))}
          <text
            className="chart-axis-title"
            textAnchor="middle"
            transform={`rotate(-90 14 ${(PLOT.top + PLOT.bottom) / 2})`}
            x="14"
            y={(PLOT.top + PLOT.bottom) / 2}
          >
            {t("equity.axisValue")}
          </text>
        </g>
        <g className="time-axis">
          {xTickIndices.map((index) => (
            <text
              className="chart-axis-tick"
              key={points[index]?.sequence ?? index}
              textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
              x={x(index)}
              y={PLOT.bottom + 22}
            >
              {new Date(points[index]?.timestamp ?? "").toLocaleDateString(
                intlLocale,
                {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                },
              )}
            </text>
          ))}
          <text
            className="chart-axis-title"
            textAnchor="middle"
            x={(PLOT.left + PLOT.right) / 2}
            y={HEIGHT - 9}
          >
            {t("equity.axisTime")}
          </text>
        </g>
        <path
          className="equity-area"
          d={`${balancePath} L ${PLOT.right} ${PLOT.bottom} L ${PLOT.left} ${PLOT.bottom} Z`}
        />
        <path className="balance-line" d={balancePath} />
        <path className="liquidation-line" d={liquidationPath} />
        {operationMarkers.map(({ trade, x: markerX, y: markerY }) => (
          <circle
            className={`equity-operation ${Number(trade.net_profit) >= 0 ? "win" : "loss"}`}
            cx={markerX}
            cy={markerY}
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
