"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";

import type { CandleRecord } from "@/lib/api/types";
import { toCandlestickData } from "@/lib/market-chart";

interface CandlestickChartProps {
  candles: CandleRecord[];
  digits: number;
  label: string;
}

const BULLISH_COLOR = "#16865f";
const BEARISH_COLOR = "#d1534b";

export function CandlestickChart({
  candles,
  digits,
  label,
}: CandlestickChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const hasFittedContentRef = useRef(false);
  const chartData = useMemo(() => toCandlestickData(candles), [candles]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 260,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#60736a",
        fontFamily: "var(--font-mono), monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(18, 54, 42, 0.05)" },
        horzLines: { color: "rgba(18, 54, 42, 0.05)" },
      },
      rightPriceScale: { borderColor: "#dce3df" },
      timeScale: {
        borderColor: "#dce3df",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(18, 54, 42, 0.24)" },
        horzLine: { color: "rgba(18, 54, 42, 0.24)" },
      },
    });
    const minimumMove = 10 ** -Math.max(0, digits);
    const series = chart.addSeries(CandlestickSeries, {
      upColor: BULLISH_COLOR,
      downColor: BEARISH_COLOR,
      borderUpColor: BULLISH_COLOR,
      borderDownColor: BEARISH_COLOR,
      wickUpColor: BULLISH_COLOR,
      wickDownColor: BEARISH_COLOR,
      priceFormat: {
        type: "price",
        precision: Math.max(0, digits),
        minMove: minimumMove,
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resize = (): void => {
      chart.applyOptions({ width: container.clientWidth });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [digits]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    series.setData(chartData);
    if (!hasFittedContentRef.current && chartData.length > 0) {
      chart.timeScale().fitContent();
      hasFittedContentRef.current = true;
    }
  }, [chartData, digits]);

  return (
    <div
      ref={containerRef}
      className="candlestick-chart"
      role="img"
      aria-label={`${label} Japanese candlestick chart with green bullish and red bearish candles`}
    />
  );
}
