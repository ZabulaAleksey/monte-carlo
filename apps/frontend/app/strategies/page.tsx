"use client";

import { Activity, BarChart3, CircleDollarSign, Gauge } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BacktestForm } from "@/components/backtests/backtest-form";
import { BacktestRunsTable } from "@/components/backtests/backtest-runs-table";
import { TradeReplay } from "@/components/backtests/trade-replay";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { apiClient } from "@/lib/api/client";
import type {
  BacktestCreateRequest,
  BacktestJobRecord,
  BacktestResultRecord,
  BacktestRunSummary,
  CandleRecord,
  StrategyDefinition,
  SymbolRecord,
} from "@/lib/api/types";
import { formatMoney, formatPercent } from "@/lib/backtests";
import { useI18n } from "@/lib/i18n";

const TERMINAL_JOB_STATES = new Set(["completed", "stopped", "failed"]);
const RESULT_PARAMETER_LABELS = {
  short_window: "advisor.short_window",
  long_window: "advisor.long_window",
  position_size: "advisor.position_size",
  stop_loss_pct: "advisor.stop_loss_pct",
  take_profit_pct: "advisor.take_profit_pct",
} as const;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export default function StrategiesPage(): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const [symbols, setSymbols] = useState<SymbolRecord[]>([]);
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [runs, setRuns] = useState<BacktestRunSummary[]>([]);
  const [result, setResult] = useState<BacktestResultRecord | null>(null);
  const [candles, setCandles] = useState<CandleRecord[]>([]);
  const [job, setJob] = useState<BacktestJobRecord | null>(null);
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replayFromStart, setReplayFromStart] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "loading" | "warning" | "success";
    message: string;
  } | null>(null);
  const selectionSequence = useRef(0);
  const jobSequence = useRef(0);
  const resultsRef = useRef<HTMLElement>(null);

  const scrollToResults = (): void => {
    const target = resultsRef.current;
    if (typeof target?.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const scrollToEquity = (): void => {
    window.requestAnimationFrame(() => {
      const target = resultsRef.current
        ?.querySelector<HTMLElement>(".result-chart-panel");
      if (typeof target?.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.getSymbols(),
      apiClient.getBacktestStrategies(),
      apiClient.getBacktestRuns(),
    ])
      .then(([nextSymbols, nextStrategies, nextRuns]) => {
        if (!active) return;
        setSymbols(nextSymbols.filter((symbol) => symbol.is_active));
        setStrategies(nextStrategies);
        setRuns(nextRuns);
        setInitialLoading(false);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Unknown error");
        setInitialLoading(false);
      });
    return () => {
      active = false;
      jobSequence.current += 1;
    };
  }, []);

  const candlesFor = (nextResult: BacktestResultRecord): Promise<CandleRecord[]> =>
    apiClient.getCandles({
      symbolId: nextResult.symbol_id,
      timeframe: nextResult.timeframe,
      startAt: nextResult.data_start,
      endAt: nextResult.data_end,
      limit: Math.min(Math.max(nextResult.candle_count, 1), 20_000),
    });

  const fetchCompletedRun = async (
    runId: string,
  ): Promise<{ result: BacktestResultRecord; candles: CandleRecord[] }> => {
    const [stored, trades] = await Promise.all([
      apiClient.getBacktestResult(runId),
      apiClient.getBacktestTrades(runId),
    ]);
    const nextResult = { ...stored, trades };
    return { result: nextResult, candles: await candlesFor(nextResult) };
  };

  const runBacktest = async (payload: BacktestCreateRequest): Promise<void> => {
    const sequence = jobSequence.current + 1;
    jobSequence.current = sequence;
    selectionSequence.current += 1;
    setLoadingRun(false);
    setRunning(true);
    setJob(null);
    setError(null);
    setNotice({ tone: "loading", message: t("history.loadingRange") });
    scrollToResults();
    try {
      let coverage = await apiClient.getHistoricalDataCoverage(
        payload.symbol_id, payload.timeframe, payload.start_at, payload.end_at,
      );
      for (let attempt = 1; !coverage.complete && attempt < 5; attempt += 1) {
        setNotice({
          tone: "loading",
          message: t("history.waitingRange", {
            attempt,
            count: coverage.candle_count,
          }),
        });
        await wait(600);
        if (sequence !== jobSequence.current) return;
        coverage = await apiClient.getHistoricalDataCoverage(
          payload.symbol_id, payload.timeframe, payload.start_at, payload.end_at,
        );
      }
      const allowPartialData = !coverage.complete;
      setNotice(allowPartialData ? {
        tone: "warning",
        message: t("history.partialProceed", { count: coverage.candle_count }),
      } : {
        tone: "success",
        message: t("history.complete", { count: coverage.candle_count }),
      });
      let current = await apiClient.startBacktestJob({
        ...payload,
        allow_partial_data: allowPartialData,
      });
      if (sequence !== jobSequence.current) return;
      setJob(current);

      while (!TERMINAL_JOB_STATES.has(current.state)) {
        await wait(120);
        if (sequence !== jobSequence.current) return;
        current = await apiClient.getBacktestJob(current.id);
        setJob(current);
      }

      if (current.state === "failed") {
        throw new Error(current.error ?? t("job.failed"));
      }
      if (current.state === "stopped" || !current.result_id) return;

      const completed = await fetchCompletedRun(current.result_id);
      if (sequence !== jobSequence.current) return;
      setResult(completed.result);
      setCandles(completed.candles);
      setReplayFromStart(true);
      setNotice(completed.result.data_complete === false ? {
        tone: "warning",
        message: t("history.partialResult", {
          count: completed.result.candle_count,
          from: new Date(completed.result.data_start).toLocaleString(intlLocale),
          to: new Date(completed.result.data_end).toLocaleString(intlLocale),
        }),
      } : null);
      setRuns(await apiClient.getBacktestRuns());
      scrollToEquity();
    } catch (reason: unknown) {
      if (sequence === jobSequence.current) {
        setError(reason instanceof Error ? reason.message : "Unknown error");
      }
    } finally {
      if (sequence === jobSequence.current) setRunning(false);
    }
  };

  const selectRun = async (runId: string): Promise<void> => {
    const selection = selectionSequence.current + 1;
    selectionSequence.current = selection;
    setLoadingRun(true);
    setError(null);
    try {
      const completed = await fetchCompletedRun(runId);
      if (selection !== selectionSequence.current) return;
      setResult(completed.result);
      setCandles(completed.candles);
      setReplayFromStart(false);
      setNotice(completed.result.data_complete === false ? {
        tone: "warning",
        message: t("history.partialResult", {
          count: completed.result.candle_count,
          from: new Date(completed.result.data_start).toLocaleString(intlLocale),
          to: new Date(completed.result.data_end).toLocaleString(intlLocale),
        }),
      } : null);
      scrollToEquity();
    } catch (reason: unknown) {
      if (selection === selectionSequence.current) {
        setError(reason instanceof Error ? reason.message : "Unknown error");
      }
    } finally {
      if (selection === selectionSequence.current) setLoadingRun(false);
    }
  };

  const pauseJob = async (): Promise<void> => {
    if (!job) return;
    setJob(await apiClient.pauseBacktestJob(job.id));
  };

  const resumeJob = async (): Promise<void> => {
    if (!job) return;
    setJob(await apiClient.resumeBacktestJob(job.id));
  };

  const stopJob = async (): Promise<void> => {
    if (!job) return;
    setJob(await apiClient.stopBacktestJob(job.id));
  };

  const toggleRun = (runId: string): void => {
    setSelectedRunIds((current) => {
      const next = new Set(current);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  const toggleAllRuns = (): void => {
    setSelectedRunIds((current) =>
      current.size === runs.length
        ? new Set()
        : new Set(runs.map((run) => run.id)),
    );
  };

  const deleteSelected = async (): Promise<void> => {
    const ids = [...selectedRunIds];
    if (ids.length === 0) return;
    setDeleting(true);
    setError(null);
    try {
      await Promise.all(ids.map((runId) => apiClient.deleteBacktest(runId)));
      setRuns(await apiClient.getBacktestRuns());
      if (result && selectedRunIds.has(result.id)) {
        setResult(null);
        setCandles([]);
      }
      setSelectedRunIds(new Set());
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unknown error");
    } finally {
      setDeleting(false);
    }
  };

  const selectedSymbol = symbols.find((symbol) => symbol.id === result?.symbol_id);

  return (
    <>
      <PageHeader
        badge={t("backtest.badge")}
        description={t("backtest.description")}
        eyebrow={t("backtest.eyebrow")}
        title={t("backtest.title")}
      />
      {error ? <ErrorState message={error} /> : null}
      {initialLoading ? <LoadingState /> : null}
      {!initialLoading && (symbols.length === 0 || strategies.length === 0) ? (
        <section className="empty-state panel">
          <h2>{t("backtest.emptyTitle")}</h2>
          <p>{t("backtest.emptyText")}</p>
        </section>
      ) : null}
      {!initialLoading && symbols.length > 0 && strategies.length > 0 ? (
        <div className="backtest-workbench">
          <aside className="backtest-sidebar">
            <BacktestForm
              busy={running}
              job={job}
              onPause={pauseJob}
              onResume={resumeJob}
              onStop={stopJob}
              onSubmit={runBacktest}
              strategies={strategies}
              symbols={symbols}
            />
            <BacktestRunsTable
              busy={loadingRun || running}
              deleting={deleting}
              onDeleteSelected={() => void deleteSelected()}
              onSelect={(runId) => void selectRun(runId)}
              onToggle={toggleRun}
              onToggleAll={toggleAllRuns}
              runs={runs}
              selectedId={result?.id ?? null}
              selectedRunIds={selectedRunIds}
              symbols={symbols}
            />
          </aside>

          <section className="backtest-results" aria-busy={loadingRun} ref={resultsRef}>
            {notice ? (
              <div
                aria-live="polite"
                className={"result-notice " + notice.tone}
                role="status"
              >
                <strong>
                  {notice.tone === "warning" ? t("history.warning") : t("history.status")}
                </strong>
                <span>{notice.message}</span>
              </div>
            ) : null}
            {loadingRun ? <LoadingState /> : null}
            {!result && !loadingRun ? (
              <div className="backtest-welcome panel">
                <span className="eyebrow">{t("backtest.ready")}</span>
                <h2>{t("backtest.readyTitle")}</h2>
                <p>{t("backtest.readyText")}</p>
              </div>
            ) : null}
            {result && !loadingRun ? (
              <>
                <div className="result-heading panel">
                  <div>
                    <span className="eyebrow">{t("result.completed")}</span>
                    <h2>{selectedSymbol?.name ?? t("result.instrument")} / {result.timeframe}</h2>
                    <p>
                      {result.strategy_name === "moving_average_cross"
                        ? t("strategy.maTitle")
                        : result.strategy_name} v{result.strategy_version} / {t("result.candles", { count: result.candle_count })}
                    </p>
                  </div>
                  <div className="result-range">
                    <span>{t("result.range")}</span>
                    <strong>{new Date(result.data_start).toLocaleString(intlLocale)}</strong>
                    <small>{t("result.to")} {new Date(result.data_end).toLocaleString(intlLocale)}</small>
                  </div>
                </div>

                <div className="metric-grid backtest-metrics">
                  <article className="metric-card primary">
                    <span>{t("metric.balance")}</span>
                    <strong>{formatMoney(result.metrics.final_balance, intlLocale)}</strong>
                    <small><CircleDollarSign size={13} /> {t("metric.start", { value: formatMoney(result.metrics.initial_capital, intlLocale) })}</small>
                  </article>
                  <article className="metric-card">
                    <span>{t("metric.return")}</span>
                    <strong className={Number(result.metrics.return_pct) >= 0 ? "positive" : "negative"}>
                      {formatPercent(result.metrics.return_pct)}
                    </strong>
                    <small><Activity size={13} /> {formatMoney(result.metrics.total_net_profit, intlLocale)}</small>
                  </article>
                  <article className="metric-card">
                    <span>{t("metric.drawdown")}</span>
                    <strong>
                      {formatMoney(result.metrics.max_drawdown_absolute ?? "0", intlLocale)}
                    </strong>
                    <small>
                      <Gauge size={13} /> {formatPercent(result.metrics.max_drawdown_pct)} / {t("metric.drawdownHint")}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>{t("metric.winRate")}</span>
                    <strong>{formatPercent(result.metrics.win_rate_pct)}</strong>
                    <small><BarChart3 size={13} /> {t("metric.trades", { count: result.metrics.total_trades })}</small>
                  </article>
                </div>

                <TradeReplay
                  key={result.id}
                  candles={candles}
                  equityPoints={result.equity_curve}
                  onSpeedChange={setReplaySpeed}
                  priceDigits={selectedSymbol?.digits}
                  speed={replaySpeed}
                  startAtEnd={!replayFromStart}
                  trades={result.trades}
                />

                <div className="run-settings panel">
                  <div><span>{t("settings.position")}</span><strong>{result.settings.position_size} {t("common.lots")}</strong></div>
                  <div><span>{t("settings.risk")}</span><strong>{result.settings.stop_loss_pct ?? "off"}% / {result.settings.take_profit_pct ?? "off"}%</strong></div>
                  <div><span>{t("settings.commission")}</span><strong>{formatMoney(result.metrics.total_commission, intlLocale)}</strong></div>
                  <div><span>{t("settings.swap")}</span><strong>{formatMoney(result.metrics.total_swap, intlLocale)}</strong></div>
                  <div><span>{t("settings.slippage")}</span><strong>{result.settings.slippage_points} {t("common.points")}</strong></div>
                  <div>
                    <span>{t("settings.parameters")}</span>
                    <strong>
                      {Object.entries(result.parameters).map(([key, value]) => {
                        const labelKey = RESULT_PARAMETER_LABELS[
                          key as keyof typeof RESULT_PARAMETER_LABELS
                        ];
                        return `${labelKey ? t(labelKey) : key}=${String(value)}`;
                      }).join(", ")}
                    </strong>
                  </div>
                </div>

              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
