"use client";

import {
  Activity,
  BarChart3,
  CircleDollarSign,
  Gauge,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BacktestTradesTable } from "@/components/backtests/backtest-trades-table";
import { CandlestickTradeChart } from "@/components/backtests/candlestick-trade-chart";
import { EquityChart } from "@/components/backtests/equity-chart";
import type {
  CandleRecord,
  EquityPointRecord,
  BacktestMetricsRecord,
  VirtualTradeRecord,
} from "@/lib/api/types";
import { formatMoney, formatPercent, sortCandles } from "@/lib/backtests";
import { useI18n } from "@/lib/i18n";

interface TradeReplayProps {
  candles: CandleRecord[];
  equityPoints?: EquityPointRecord[];
  metrics?: BacktestMetricsRecord;
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
  metrics,
  onSpeedChange = ignoreSpeedChange,
  speed = 1,
  startAtEnd = false,
  trades,
  priceDigits = 5,
}: TradeReplayProps): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const sorted = useMemo(() => sortCandles(candles), [candles]);
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
    if (!playing || sorted.length === 0 || index >= sorted.length - 1) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setIndex((current) => Math.min(current + 1, sorted.length - 1));
    }, Math.max(12, 220 / Math.max(speed, 0.5)));
    return () => window.clearTimeout(timer);
  }, [index, playing, sorted.length, speed]);

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

  const visibleCount = Math.min(index + 1, sorted.length);
  const nextCandle = visibleCount < sorted.length ? sorted[visibleCount] : undefined;
  const visibleBefore = nextCandle?.open_time;
  const cutoff = visibleBefore
    ? new Date(visibleBefore).getTime()
    : Number.POSITIVE_INFINITY;
  const visibleEquity = useMemo(
    () => equityPoints.filter(
      (point) => new Date(point.timestamp).getTime() <= cutoff,
    ),
    [cutoff, equityPoints],
  );
  const visibleClosedTrades = useMemo(
    () => trades.filter(
      (trade) => new Date(trade.closed_at).getTime() < cutoff,
    ),
    [cutoff, trades],
  );
  const replayFinished = stopped || sorted.length === 0 || index >= sorted.length - 1;
  const currentMetrics = useMemo(() => {
    if (!metrics || replayFinished) return metrics;
    const initialCapital = Number(metrics.initial_capital);
    const currentBalance = Number(
      visibleEquity[visibleEquity.length - 1]?.balance ?? metrics.initial_capital,
    );
    const totalNetProfit = currentBalance - initialCapital;
    const maximumDrawdownAbsolute = Math.max(
      0,
      ...visibleEquity.map((point) => Number(point.drawdown_absolute)),
    );
    const maximumDrawdownPct = Math.max(
      0,
      ...visibleEquity.map((point) => Number(point.drawdown_pct)),
    );
    const winningTrades = visibleClosedTrades.filter(
      (trade) => Number(trade.net_profit) > 0,
    ).length;
    const winRate = visibleClosedTrades.length > 0
      ? (winningTrades / visibleClosedTrades.length) * 100
      : 0;
    return {
      ...metrics,
      final_balance: String(currentBalance),
      total_net_profit: String(totalNetProfit),
      return_pct: String(initialCapital === 0 ? 0 : (totalNetProfit / initialCapital) * 100),
      max_drawdown_absolute: String(maximumDrawdownAbsolute),
      max_drawdown_pct: String(maximumDrawdownPct),
      total_trades: visibleClosedTrades.length,
      winning_trades: winningTrades,
      losing_trades: visibleClosedTrades.filter(
        (trade) => Number(trade.net_profit) < 0,
      ).length,
      win_rate_pct: String(winRate),
    };
  }, [metrics, replayFinished, visibleClosedTrades, visibleEquity]);

  return (
    <>
      {currentMetrics ? (
        <div className="metric-grid backtest-metrics">
          <article className="metric-card primary">
            <span>{t("metric.balance")}</span>
            <strong>{formatMoney(currentMetrics.final_balance, intlLocale)}</strong>
            <small>
              <CircleDollarSign size={13} /> {t("metric.start", {
                value: formatMoney(currentMetrics.initial_capital, intlLocale),
              })}
            </small>
          </article>
          <article className="metric-card">
            <span>{t("metric.return")}</span>
            <strong className={Number(currentMetrics.return_pct) >= 0 ? "positive" : "negative"}>
              {formatPercent(currentMetrics.return_pct)}
            </strong>
            <small><Activity size={13} /> {formatMoney(currentMetrics.total_net_profit, intlLocale)}</small>
          </article>
          <article className="metric-card">
            <span>{t("metric.drawdown")}</span>
            <strong>{formatMoney(currentMetrics.max_drawdown_absolute ?? "0", intlLocale)}</strong>
            <small>
              <Gauge size={13} /> {formatPercent(currentMetrics.max_drawdown_pct)} / {t("metric.drawdownHint")}
            </small>
          </article>
          <article className="metric-card">
            <span>{t("metric.winRate")}</span>
            <strong>{formatPercent(currentMetrics.win_rate_pct)}</strong>
            <small>
              <BarChart3 size={13} /> {t("metric.trades", { count: currentMetrics.total_trades })}
            </small>
          </article>
        </div>
      ) : null}
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
            checked={followLatest}
            onChange={(event) => setFollowLatest(event.target.checked)}
            type="checkbox"
          />
          {t("replay.follow")}
        </label>
        <label>
          {t("replay.speed")}
          <select
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            value={speed}
          >
            {SPEEDS.map((item) => <option key={item} value={item}>{item}{"\u00d7"}</option>)}
          </select>
        </label>
        <div className="replay-actions">
          <button
            disabled={stopped || playing || sorted.length === 0}
            onClick={() => setPlaying(true)}
            type="button"
          >
            <Play size={13} /> {t("replay.play")}
          </button>
          <button
            disabled={!playing}
            onClick={() => setPlaying(false)}
            type="button"
          >
            <Pause size={13} /> {t("replay.pause")}
          </button>
          <button
            disabled={stopped || sorted.length === 0}
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
        candles={sorted}
        followLatest={followLatest}
        priceDigits={priceDigits}
        smoothFollow
        smoothScale
        trades={trades}
        visibleCandleCount={visibleCount}
        visibleUntil={visibleBefore}
      />
      </section>
      <BacktestTradesTable
        trades={trades}
        visibleBefore={visibleBefore}
      />
    </>
  );
}
