"use client";

import { Maximize2, Minimize2, Pause, Play, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BacktestTradesTable } from "@/components/backtests/backtest-trades-table";
import { CandlestickTradeChart } from "@/components/backtests/candlestick-trade-chart";
import { EquityChart } from "@/components/backtests/equity-chart";
import type {
  CandleRecord,
  EquityPointRecord,
  VirtualTradeRecord,
} from "@/lib/api/types";
import { sortCandles } from "@/lib/backtests";
import { useI18n } from "@/lib/i18n";

interface TradeReplayProps {
  candles: CandleRecord[];
  equityPoints?: EquityPointRecord[];
  onSpeedChange?: (speed: number) => void;
  speed?: number;
  startAtEnd?: boolean;
  trades: VirtualTradeRecord[];
  priceDigits?: number;
}

const SPEEDS = [0.5, 1, 2, 4, 5, 10, 20, 50, 100] as const;

const ignoreSpeedChange = (): void => undefined;
type FullscreenChart = "equity" | "execution";

export function TradeReplay({
  candles,
  equityPoints = [],
  onSpeedChange = ignoreSpeedChange,
  speed = 1,
  startAtEnd = false,
  trades,
  priceDigits = 5,
}: TradeReplayProps): React.JSX.Element {
  const { t } = useI18n();
  const sorted = useMemo(() => sortCandles(candles), [candles]);
  const [enabled, setEnabled] = useState(true);
  const [followLatest, setFollowLatest] = useState(true);
  const [playing, setPlaying] = useState(!startAtEnd);
  const [stopped, setStopped] = useState(false);
  const [index, setIndex] = useState(startAtEnd ? Math.max(sorted.length - 1, 0) : 0);
  const [fullscreenChart, setFullscreenChart] = useState<FullscreenChart | null>(null);
  const equitySectionRef = useRef<HTMLElement>(null);
  const executionSectionRef = useRef<HTMLElement>(null);
  const equityFullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const executionFullscreenButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIndex(startAtEnd ? Math.max(sorted.length - 1, 0) : 0);
    setPlaying(!startAtEnd);
    setStopped(false);
  }, [candles, sorted.length, startAtEnd]);

  useEffect(() => {
    if (!enabled || !playing || sorted.length === 0 || index >= sorted.length - 1) {
      return undefined;
    }
    const datasetStep = Math.max(1, Math.ceil(sorted.length / 240));
    const speedStep = speed > 10 ? Math.ceil(speed / 10) : 1;
    const step = datasetStep * speedStep;
    const timer = window.setTimeout(() => {
      setIndex((current) => Math.min(current + step, sorted.length - 1));
    }, Math.max(20, 220 / Math.min(speed, 10)));
    return () => window.clearTimeout(timer);
  }, [enabled, index, playing, sorted.length, speed]);

  useEffect(() => {
    if (index >= sorted.length - 1) setPlaying(false);
  }, [index, sorted.length]);

  useEffect(() => {
    if (!fullscreenChart) return undefined;
    const opener = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const container = fullscreenChart === "equity"
      ? equitySectionRef.current
      : executionSectionRef.current;
    const closeButton = fullscreenChart === "equity"
      ? equityFullscreenButtonRef.current
      : executionFullscreenButtonRef.current;
    document.body.classList.add("chart-fullscreen-open");
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFullscreenChart(null);
        return;
      }
      if (event.key !== "Tab" || !container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        container.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    closeButton?.focus();
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("chart-fullscreen-open");
      opener?.focus();
    };
  }, [fullscreenChart]);

  const visibleCount = enabled ? Math.min(index + 1, sorted.length) : sorted.length;
  const visibleCandles = sorted.slice(0, visibleCount);
  const nextCandle = enabled && visibleCount < sorted.length ? sorted[visibleCount] : undefined;
  const visibleBefore = nextCandle?.open_time;
  const cutoff = visibleBefore
    ? new Date(visibleBefore).getTime()
    : Number.POSITIVE_INFINITY;
  const visibleEquity = enabled
    ? equityPoints.filter(
        (point) => new Date(point.timestamp).getTime() <= cutoff,
      )
    : equityPoints;
  const visibleClosedTrades = enabled
    ? trades.filter((trade) => new Date(trade.closed_at).getTime() < cutoff)
    : trades;

  const toggleEnabled = (checked: boolean): void => {
    setEnabled(checked);
    setPlaying(false);
    setIndex(checked ? 0 : Math.max(sorted.length - 1, 0));
  };

  return (
    <>
      <section
        aria-label={fullscreenChart === "equity" ? t("equity.title") : undefined}
        aria-modal={fullscreenChart === "equity" ? true : undefined}
        className={`panel result-chart-panel${fullscreenChart === "equity" ? " chart-fullscreen" : ""}`}
        role={fullscreenChart === "equity" ? "dialog" : undefined}
        ref={equitySectionRef}
        tabIndex={fullscreenChart === "equity" ? -1 : undefined}
      >
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{t("equity.eyebrow")}</span>
            <h2>{t("equity.title")}</h2>
          </div>
          <div className="chart-heading-actions">
            <span className="muted">{t("equity.hint")}</span>
            <button
              aria-label={fullscreenChart === "equity"
                ? t("chart.fullscreenClose")
                : t("chart.fullscreenOpen", { chart: t("equity.title") })}
              className="chart-fullscreen-button"
              ref={equityFullscreenButtonRef}
              onClick={() => setFullscreenChart(
                fullscreenChart === "equity" ? null : "equity",
              )}
              type="button"
            >
              {fullscreenChart === "equity" ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
        <EquityChart points={visibleEquity} trades={visibleClosedTrades} />
      </section>
      <section
        aria-label={fullscreenChart === "execution" ? t("replay.title") : undefined}
        aria-modal={fullscreenChart === "execution" ? true : undefined}
        className={`panel result-chart-panel${fullscreenChart === "execution" ? " chart-fullscreen" : ""}`}
        role={fullscreenChart === "execution" ? "dialog" : undefined}
        ref={executionSectionRef}
        tabIndex={fullscreenChart === "execution" ? -1 : undefined}
      >
      <div className="panel-heading replay-heading">
        <div>
          <span className="eyebrow">{t("replay.eyebrow")}</span>
          <h2>{t("replay.title")}</h2>
        </div>
        <div className="chart-heading-actions">
          <span className="muted">{t("replay.hint")}</span>
          <button
            aria-label={fullscreenChart === "execution"
              ? t("chart.fullscreenClose")
              : t("chart.fullscreenOpen", { chart: t("replay.title") })}
            className="chart-fullscreen-button"
            ref={executionFullscreenButtonRef}
            onClick={() => setFullscreenChart(
              fullscreenChart === "execution" ? null : "execution",
            )}
            type="button"
          >
            {fullscreenChart === "execution" ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      <div className="replay-toolbar">
        <label className="replay-toggle">
          <input
            checked={enabled}
            onChange={(event) => toggleEnabled(event.target.checked)}
            type="checkbox"
          />
          {t("replay.show")}
        </label>
        <label className="replay-toggle">
          <input
            checked={followLatest}
            disabled={!enabled}
            onChange={(event) => setFollowLatest(event.target.checked)}
            type="checkbox"
          />
          {t("replay.follow")}
        </label>
        <label>
          {t("replay.speed")}
          <select
            disabled={!enabled}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            value={speed}
          >
            {SPEEDS.map((item) => <option key={item} value={item}>{item}{"\u00d7"}</option>)}
          </select>
        </label>
        <div className="replay-actions">
          <button
            disabled={!enabled || stopped || playing || sorted.length === 0}
            onClick={() => setPlaying(true)}
            type="button"
          >
            <Play size={13} /> {t("replay.play")}
          </button>
          <button
            disabled={!enabled || !playing}
            onClick={() => setPlaying(false)}
            type="button"
          >
            <Pause size={13} /> {t("replay.pause")}
          </button>
          <button
            disabled={!enabled || stopped || sorted.length === 0}
            onClick={() => {
              setPlaying(false);
              setStopped(true);
            }}
            type="button"
          >
            <Square size={12} /> {t("replay.stop")}
          </button>
        </div>
        <span className="replay-position">
          {t("replay.progress", {
            current: sorted.length ? visibleCount : 0,
            total: sorted.length,
          })}
        </span>
      </div>
      <CandlestickTradeChart
        candles={visibleCandles}
        followLatest={enabled && followLatest}
        priceDigits={priceDigits}
        trades={trades}
        visibleUntil={visibleBefore}
      />
      </section>
      <BacktestTradesTable
        animationEnabled={enabled}
        trades={trades}
        visibleBefore={visibleBefore}
      />
    </>
  );
}
