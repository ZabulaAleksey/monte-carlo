"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CandleRecord, VirtualTradeRecord } from "@/lib/api/types";
import type { TradeMarker } from "@/lib/backtests";
import {
  buildPeriodSeparators,
  formatMoney,
  mapTradesToCandles,
  sortCandles,
} from "@/lib/backtests";
import { useI18n } from "@/lib/i18n";

interface CandlestickTradeChartProps {
  candles: CandleRecord[];
  followLatest?: boolean;
  priceDigits?: number;
  trades: VirtualTradeRecord[];
  visibleUntil?: string;
}

interface PositionedTradeMarker extends TradeMarker {
  labelY: number;
  markerX: number;
  markerY: number;
}

interface ViewportRange {
  end: number;
  offset: number;
  start: number;
  width: number;
}

const MINIMUM_WIDTH = 900;
const HEIGHT = 320;
const PADDING = 30;

export function CandlestickTradeChart({
  candles,
  followLatest = false,
  priceDigits = 5,
  trades,
  visibleUntil,
}: CandlestickTradeChartProps): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const visible = sortCandles(candles);
  const frameRef = useRef<HTMLDivElement>(null);
  const [viewportRange, setViewportRange] = useState<ViewportRange>({
    start: 0,
    end: Number.MAX_SAFE_INTEGER,
    offset: 0,
    width: MINIMUM_WIDTH,
  });
  const width = Math.max(MINIMUM_WIDTH, visible.length * 7 + PADDING * 2);
  const step = visible.length > 0 ? (width - PADDING * 2) / visible.length : 0;
  const latestCandleX = visible.length > 0
    ? PADDING + step * (visible.length - 1) + step / 2
    : 0;

  const updateViewportRange = useCallback((): void => {
    const frame = frameRef.current;
    if (!frame || visible.length === 0 || step <= 0 || frame.clientWidth <= 0) {
      setViewportRange({
        start: 0,
        end: Math.max(visible.length - 1, 0),
        offset: 0,
        width: frame?.clientWidth ?? MINIMUM_WIDTH,
      });
      return;
    }
    const start = Math.max(
      0,
      Math.floor((frame.scrollLeft - PADDING) / step),
    );
    const end = Math.min(
      visible.length - 1,
      Math.ceil((frame.scrollLeft + frame.clientWidth - PADDING) / step),
    );
    const offset = frame.scrollLeft;
    const viewportWidth = frame.clientWidth;
    setViewportRange((current) =>
      current.start === start &&
      current.end === end &&
      current.offset === offset &&
      current.width === viewportWidth
        ? current
        : { start, end, offset, width: viewportWidth },
    );
  }, [step, visible.length]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    updateViewportRange();
    frame.addEventListener("scroll", updateViewportRange, { passive: true });
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateViewportRange);
    observer?.observe(frame);
    return () => {
      frame.removeEventListener("scroll", updateViewportRange);
      observer?.disconnect();
    };
  }, [updateViewportRange]);

  useEffect(() => {
    const frame = frameRef.current;
    if (followLatest && frame) {
      const maximumScroll = Math.max(0, frame.scrollWidth - frame.clientWidth);
      const target = latestCandleX - frame.clientWidth * 0.72;
      frame.scrollLeft = Math.max(0, Math.min(maximumScroll, target));
      updateViewportRange();
    }
  }, [followLatest, latestCandleX, updateViewportRange]);

  if (visible.length === 0) {
    return <div className="chart-empty">{t("replay.empty")}</div>;
  }
  const scaleCandles = visible.slice(
    viewportRange.start,
    Math.min(viewportRange.end + 1, visible.length),
  );
  const scaleSource = scaleCandles.length > 0 ? scaleCandles : visible;
  const lows = scaleSource.map((item) => Number(item.low));
  const highs = scaleSource.map((item) => Number(item.high));
  const minimum = Math.min(...lows);
  const maximum = Math.max(...highs);
  const range = maximum - minimum || 1;
  const plotHeight = HEIGHT - PADDING * 2;
  const candleWidth = Math.max(Math.min(step * 0.55, 9), 2);
  const y = (price: number): number =>
    PADDING + ((maximum - price) / range) * plotHeight;
  const x = (index: number): number => PADDING + step * index + step / 2;
  const markers = mapTradesToCandles(visible, trades, visibleUntil);
  const periods = buildPeriodSeparators(visible, intlLocale);
  const markerRanks = new Map<string, number>();
  const positionedMarkers: PositionedTradeMarker[] = markers.map((marker) => {
    const rankKey = `${marker.kind}-${marker.candleIndex}`;
    const rank = markerRanks.get(rankKey) ?? 0;
    markerRanks.set(rankKey, rank + 1);
    const item = visible[marker.candleIndex];
    const horizontalOffset = rank === 0
      ? 0
      : (rank % 2 === 0 ? 1 : -1) * Math.ceil(rank / 2) * 7;
    const markerX = x(marker.candleIndex) + horizontalOffset;
    const baseY = marker.kind === "entry"
      ? y(Number(item?.low ?? minimum)) + 13
      : y(Number(item?.high ?? maximum)) - 13;
    const markerY = Math.max(10, Math.min(HEIGHT - 10, baseY));
    return {
      ...marker,
      labelY: Math.max(12, markerY - rank * 11),
      markerX,
      markerY,
    };
  });
  const tradePositions = new Map<
    number,
    Partial<Record<TradeMarker["kind"], PositionedTradeMarker>>
  >();
  positionedMarkers.forEach((marker) => {
    const pair = tradePositions.get(marker.tradeSequence) ?? {};
    pair[marker.kind] = marker;
    tradePositions.set(marker.tradeSequence, pair);
  });
  const connections: Array<{
    entry: PositionedTradeMarker;
    exit: PositionedTradeMarker;
    sequence: number;
  }> = [];
  tradePositions.forEach((pair, sequence) => {
    if (pair.entry && pair.exit) {
      connections.push({ entry: pair.entry, exit: pair.exit, sequence });
    }
  });
  const visibleTradeCount = new Set(markers.map((marker) => marker.tradeSequence)).size;
  const priceTicks = Array.from(
    { length: 5 },
    (_, index) => maximum - (range * index) / 4,
  );
  const axisStart = Math.max(0, viewportRange.offset);
  const axisEnd = Math.min(width, axisStart + viewportRange.width);
  const normalizedDigits = Math.min(Math.max(priceDigits, 0), 6);

  return (
    <div className="chart-frame" ref={frameRef}>
      <div className="chart-caption">
        <span>{t("replay.candles", { count: visible.length })}</span>
        <span>{t("replay.markers")} / {t("replay.guides")}</span>
      </div>
      <svg
        aria-label={t("replay.chartAria", { count: visibleTradeCount })}
        className="candlestick-chart"
        data-scale-end={Math.min(viewportRange.end, visible.length - 1)}
        data-scale-max={maximum}
        data-scale-min={minimum}
        data-scale-start={viewportRange.start}
        role="img"
        style={{ minWidth: `${width}px` }}
        viewBox={`0 0 ${width} ${HEIGHT}`}
      >
        <g className="price-axis">
          {priceTicks.map((price) => (
            <g key={price}>
              <line
                x1={axisStart}
                x2={axisEnd}
                y1={y(price)}
                y2={y(price)}
              />
              <text x={axisStart + 7} y={y(price) - 4}>
                {price.toFixed(normalizedDigits)}
              </text>
            </g>
          ))}
        </g>
        {periods.map((period) => {
          const periodX = x(period.candleIndex) - step / 2;
          return (
            <g className="period-separator" key={`${period.candleIndex}-${period.label}`}>
              <line x1={periodX} x2={periodX} y1="18" y2={HEIGHT - 12} />
              <text x={periodX + 4} y="14">{period.label}</text>
            </g>
          );
        })}
        {visible.map((item, index) => {
          const open = Number(item.open);
          const close = Number(item.close);
          const top = y(Math.max(open, close));
          const bodyHeight = Math.max(Math.abs(y(open) - y(close)), 1.5);
          const direction = close >= open ? "up" : "down";
          return (
            <g className={`candle ${direction}`} key={item.id}>
              <title>
                {t("dashboard.candleTooltip", {
                  time: new Date(item.open_time).toLocaleString(intlLocale),
                  open: item.open,
                  high: item.high,
                  low: item.low,
                  close: item.close,
                })}
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
        {connections.map(({ entry, exit, sequence }) => (
          <g className={`trade-connection ${entry.side}`} key={`${sequence}-connection`}>
            <title>#{sequence}</title>
            <line
              data-trade-sequence={sequence}
              x1={entry.markerX}
              x2={exit.markerX}
              y1={entry.markerY}
              y2={exit.markerY}
            />
          </g>
        ))}
        {positionedMarkers.map((marker) => {
          const isEntry = marker.kind === "entry";
          const className = `trade-marker ${marker.side} ${marker.kind}`;
          const side = marker.side === "buy" ? t("common.buy") : t("common.sell");
          return isEntry ? (
            <polygon
              aria-label={t("replay.entryAria", {
                sequence: marker.tradeSequence,
                side,
              })}
              className={className}
              key={`${marker.tradeSequence}-entry`}
              points={`${marker.markerX},${marker.markerY - 6} ${marker.markerX - 6},${marker.markerY + 5} ${marker.markerX + 6},${marker.markerY + 5}`}
            />
          ) : (
            <g key={`${marker.tradeSequence}-exit`}>
              <circle
                aria-label={t("replay.exitPnlAria", {
                  sequence: marker.tradeSequence,
                  value: `${Number(marker.netProfit) >= 0 ? "+" : "-"}${formatMoney(Math.abs(Number(marker.netProfit)), intlLocale)}`,
                })}
                className={className}
                cx={marker.markerX}
                cy={marker.markerY}
                r="5"
              />
              <text
                aria-hidden="true"
                className={`trade-exit-pnl ${Number(marker.netProfit) >= 0 ? "positive" : "negative"}`}
                textAnchor={marker.markerX > width - 90 ? "end" : "start"}
                x={marker.markerX > width - 90 ? marker.markerX - 8 : marker.markerX + 8}
                y={marker.labelY + 3}
              >
                {Number(marker.netProfit) >= 0 ? "+" : "-"}{formatMoney(Math.abs(Number(marker.netProfit)), intlLocale)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
