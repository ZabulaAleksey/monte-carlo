"use client";

import { Pause, Play, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BacktestTradesTable } from "@/components/backtests/backtest-trades-table";
import { CandlestickTradeChart } from "@/components/backtests/candlestick-trade-chart";
import type { CandleRecord, VirtualTradeRecord } from "@/lib/api/types";
import { sortCandles } from "@/lib/backtests";
import { useI18n } from "@/lib/i18n";

interface TradeReplayProps {
  candles: CandleRecord[];
  onSpeedChange?: (speed: number) => void;
  speed?: number;
  startAtEnd?: boolean;
  trades: VirtualTradeRecord[];
}

const SPEEDS = [0.5, 1, 2, 4, 5, 10, 20, 50, 100] as const;

const ignoreSpeedChange = (): void => undefined;

export function TradeReplay({
  candles,
  onSpeedChange = ignoreSpeedChange,
  speed = 1,
  startAtEnd = false,
  trades,
}: TradeReplayProps): React.JSX.Element {
  const { t } = useI18n();
  const sorted = useMemo(() => sortCandles(candles), [candles]);
  const [enabled, setEnabled] = useState(true);
  const [followLatest, setFollowLatest] = useState(true);
  const [playing, setPlaying] = useState(!startAtEnd);
  const [index, setIndex] = useState(startAtEnd ? Math.max(sorted.length - 1, 0) : 0);

  useEffect(() => {
    setIndex(startAtEnd ? Math.max(sorted.length - 1, 0) : 0);
    setPlaying(!startAtEnd);
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

  const visibleCount = enabled ? Math.min(index + 1, sorted.length) : sorted.length;
  const visibleCandles = sorted.slice(0, visibleCount);
  const nextCandle = enabled && visibleCount < sorted.length ? sorted[visibleCount] : undefined;
  const visibleBefore = nextCandle?.open_time;

  const toggleEnabled = (checked: boolean): void => {
    setEnabled(checked);
    setPlaying(false);
    setIndex(checked ? 0 : Math.max(sorted.length - 1, 0));
  };

  return (
    <>
      <section className="panel result-chart-panel">
      <div className="panel-heading replay-heading">
        <div>
          <span className="eyebrow">{t("replay.eyebrow")}</span>
          <h2>{t("replay.title")}</h2>
        </div>
        <span className="muted">{t("replay.hint")}</span>
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
            disabled={!enabled || playing || sorted.length === 0}
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
            disabled={!enabled || sorted.length === 0}
            onClick={() => {
              setPlaying(false);
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
