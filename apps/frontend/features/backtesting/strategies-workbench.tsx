"use client";

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
  QuoteRecord,
  StrategyDefinition,
  SymbolRecord,
} from "@/lib/api/types";
import {
  BACKTEST_TIMEFRAMES,
  formatMoney,
  splitHistoricalIntervalByYear,
} from "@/lib/backtests";
import { useI18n } from "@/lib/i18n";

const TERMINAL_JOB_STATES = new Set(["completed", "stopped", "failed"]);
const HISTORY_POLL_INTERVAL_MS = 1_000;
const HISTORY_POLL_ATTEMPTS = 60;
const AVAILABILITY_POLL_ATTEMPTS = 20;
const TIMEFRAME_DURATION_MS: Record<(typeof BACKTEST_TIMEFRAMES)[number], number> = {
  M1: 60_000,
  M5: 5 * 60_000,
  M15: 15 * 60_000,
  M30: 30 * 60_000,
  H1: 60 * 60_000,
  H4: 4 * 60 * 60_000,
  D1: 24 * 60 * 60_000,
};
const EMPTY_TIMEFRAMES: readonly string[] = [];
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

export function StrategiesWorkbench(): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const [symbols, setSymbols] = useState<SymbolRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [selectedSymbolId, setSelectedSymbolId] = useState("");
  const [availableTimeframes, setAvailableTimeframes] = useState<Record<string, readonly string[]>>({});
  const [timeframesLoading, setTimeframesLoading] = useState(false);
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
  const timeframeSequence = useRef(0);

  const scrollToResults = (): void => {
    const target = resultsRef.current;
    if (typeof target?.scrollTo === "function") {
      target.scrollTo({ behavior: "smooth", top: 0 });
    }
  };

  const scrollToEquity = (): void => {
    window.requestAnimationFrame(() => {
      const target = resultsRef.current
        ?.querySelector<HTMLElement>(".result-chart-panel");
      const results = resultsRef.current;
      if (target && results && typeof results.scrollTo === "function") {
        const targetBox = target.getBoundingClientRect();
        const resultsBox = results.getBoundingClientRect();
        results.scrollTo({
          behavior: "smooth",
          top: Math.max(results.scrollTop + targetBox.top - resultsBox.top - 8, 0),
        });
      }
    });
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.getSymbols(),
      apiClient.getQuotes(),
      apiClient.getBacktestStrategies(),
      apiClient.getBacktestRuns(),
    ])
      .then(([nextSymbols, nextQuotes, nextStrategies, nextRuns]) => {
        if (!active) return;
        const quotedSymbolIds = new Set(
          nextQuotes.map((quote) => quote.symbol_id),
        );
        const nextAvailableSymbols = nextSymbols.filter(
          (symbol) => symbol.is_active && quotedSymbolIds.has(symbol.id),
        );
        setSymbols(nextAvailableSymbols);
        setQuotes(nextQuotes);
        setSelectedSymbolId(nextAvailableSymbols[0]?.id ?? "");
        setTimeframesLoading(nextAvailableSymbols.length > 0);
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
      timeframeSequence.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!selectedSymbolId || availableTimeframes[selectedSymbolId]) return;
    const quote = quotes.find((item) => item.symbol_id === selectedSymbolId);
    if (!quote) {
      setAvailableTimeframes((current) => ({ ...current, [selectedSymbolId]: [] }));
      setTimeframesLoading(false);
      return;
    }
    const sequence = timeframeSequence.current + 1;
    timeframeSequence.current = sequence;
    setTimeframesLoading(true);

    const probe = async (
      timeframe: (typeof BACKTEST_TIMEFRAMES)[number],
    ): Promise<boolean> => {
      try {
        const cached = await apiClient.getCandles({
          symbolId: selectedSymbolId,
          timeframe,
          limit: 1,
          source: quote.source,
        });
        if (cached.length > 0) return true;
        if (quote.source !== "mt5") return false;

        const observedAt = new Date(quote.observed_at);
        if (Number.isNaN(observedAt.getTime())) return false;
        const endAt = observedAt.toISOString();
        const startAt = new Date(
          observedAt.getTime() - TIMEFRAME_DURATION_MS[timeframe] * 3,
        ).toISOString();
        let request = await apiClient.requestHistoricalData(
          selectedSymbolId,
          timeframe,
          startAt,
          endAt,
        );
        for (
          let attempt = 0;
          attempt < AVAILABILITY_POLL_ATTEMPTS &&
          request.status !== "completed" &&
          request.status !== "failed";
          attempt += 1
        ) {
          await wait(HISTORY_POLL_INTERVAL_MS);
          request = await apiClient.getHistoricalDataRequest(request.id);
        }
        return request.status === "completed" && request.candle_count > 0;
      } catch {
        return false;
      }
    };

    void Promise.all(BACKTEST_TIMEFRAMES.map(probe)).then((availability) => {
      if (sequence !== timeframeSequence.current) return;
      setAvailableTimeframes((current) => ({
        ...current,
        [selectedSymbolId]: BACKTEST_TIMEFRAMES.filter((_, index) => availability[index]),
      }));
      setTimeframesLoading(false);
    });
  }, [availableTimeframes, quotes, selectedSymbolId]);

  const selectBacktestSymbol = (symbolId: string): void => {
    setSelectedSymbolId(symbolId);
    setTimeframesLoading(!availableTimeframes[symbolId]);
  };

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
      if (sequence !== jobSequence.current) return;
      if (!coverage.complete) {
        const missingIntervals = coverage.missing_intervals.length > 0
          ? coverage.missing_intervals
          : [{ start_at: payload.start_at, end_at: payload.end_at }];
        const yearlyIntervals = missingIntervals.flatMap((interval) =>
          splitHistoricalIntervalByYear(interval.start_at, interval.end_at)
        );
        const dateFormatter = new Intl.DateTimeFormat(intlLocale, {
          dateStyle: "medium",
          timeZone: "UTC",
        });

        for (const interval of yearlyIntervals) {
          if (coverage.complete || sequence !== jobSequence.current) break;
          setNotice({
            tone: "loading",
            message: t("history.loadingYear", {
              year: interval.year,
              from: dateFormatter.format(new Date(interval.startAt)),
              to: dateFormatter.format(new Date(interval.endAt)),
            }),
          });
          let historyRequest = await apiClient.requestHistoricalData(
            payload.symbol_id,
            payload.timeframe,
            interval.startAt,
            interval.endAt,
          );
          if (sequence !== jobSequence.current) return;
          if (historyRequest.status === "failed") {
            setNotice({
              tone: "warning",
              message: t("history.requestFailed", {
                reason: historyRequest.error ?? "MT5",
              }),
            });
          }
          for (
            let attempt = 1;
            !coverage.complete &&
              historyRequest.status !== "failed" &&
              attempt <= HISTORY_POLL_ATTEMPTS;
            attempt += 1
          ) {
            setNotice({
              tone: "loading",
              message: t("history.waitingYear", {
                year: interval.year,
                attempt,
                count: coverage.candle_count,
                total: HISTORY_POLL_ATTEMPTS,
              }),
            });
            await wait(HISTORY_POLL_INTERVAL_MS);
            if (sequence !== jobSequence.current) return;
            [historyRequest, coverage] = await Promise.all([
              apiClient.getHistoricalDataRequest(historyRequest.id),
              apiClient.getHistoricalDataCoverage(
                payload.symbol_id,
                payload.timeframe,
                payload.start_at,
                payload.end_at,
              ),
            ]);
            if (sequence !== jobSequence.current) return;
            if (historyRequest.status === "failed") {
              setNotice({
                tone: "warning",
                message: t("history.requestFailed", {
                  reason: historyRequest.error ?? "MT5",
                }),
              });
            }
            if (historyRequest.status === "completed") break;
          }
          coverage = await apiClient.getHistoricalDataCoverage(
            payload.symbol_id,
            payload.timeframe,
            payload.start_at,
            payload.end_at,
          );
          if (sequence !== jobSequence.current) return;
        }
      }
      const hasConfirmedData =
        coverage.candle_count > 0 && coverage.cached_intervals.length > 0;
      if (!coverage.complete && !hasConfirmedData) {
        setNotice({ tone: "warning", message: t("history.unavailable") });
        return;
      }
      const allowPartialData = !coverage.complete;
      setNotice(allowPartialData ? {
        tone: "warning",
        message: t("history.partialProceed", { count: coverage.candle_count }),
      } : {
        tone: "success",
        message: t("history.complete", { count: coverage.candle_count }),
      });
      if (sequence !== jobSequence.current) return;
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
        if (sequence !== jobSequence.current) return;
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
    const activeJob = job;
    jobSequence.current += 1;
    if (activeJob) {
      setJob(await apiClient.stopBacktestJob(activeJob.id));
    }
    setRunning(false);
    setNotice({ tone: "warning", message: t("job.stopped") });
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
          <aside className="backtest-sidebar" data-testid="backtest-setup-column">
            <BacktestForm
              busy={running}
              job={job}
              onSymbolChange={selectBacktestSymbol}
              onPause={pauseJob}
              onResume={resumeJob}
              onStop={stopJob}
              onSubmit={runBacktest}
              strategies={strategies}
              symbols={symbols}
              timeframes={availableTimeframes[selectedSymbolId] ?? EMPTY_TIMEFRAMES}
              timeframesLoading={timeframesLoading}
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

          <section
            aria-busy={loadingRun}
            className="backtest-results"
            data-testid="backtest-results-column"
            ref={resultsRef}
          >
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

                <TradeReplay
                  key={result.id}
                  candles={candles}
                  equityPoints={result.equity_curve}
                  metrics={result.metrics}
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
