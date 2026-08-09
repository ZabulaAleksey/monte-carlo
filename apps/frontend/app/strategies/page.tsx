"use client";

import { Activity, BarChart3, CircleDollarSign, Gauge } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BacktestForm } from "@/components/backtests/backtest-form";
import { BacktestRunsTable } from "@/components/backtests/backtest-runs-table";
import { BacktestTradesTable } from "@/components/backtests/backtest-trades-table";
import { CandlestickTradeChart } from "@/components/backtests/candlestick-trade-chart";
import { EquityChart } from "@/components/backtests/equity-chart";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { apiClient } from "@/lib/api/client";
import type {
  BacktestCreateRequest,
  BacktestResultRecord,
  BacktestRunSummary,
  CandleRecord,
  StrategyDefinition,
  SymbolRecord,
} from "@/lib/api/types";
import { formatMoney, formatPercent } from "@/lib/backtests";

export default function StrategiesPage(): React.JSX.Element {
  const [symbols, setSymbols] = useState<SymbolRecord[]>([]);
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [runs, setRuns] = useState<BacktestRunSummary[]>([]);
  const [result, setResult] = useState<BacktestResultRecord | null>(null);
  const [candles, setCandles] = useState<CandleRecord[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectionSequence = useRef(0);

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
    };
  }, []);

  const candlesFor = (nextResult: BacktestResultRecord): Promise<CandleRecord[]> =>
    apiClient.getCandles({
      symbolId: nextResult.symbol_id,
      timeframe: nextResult.timeframe,
      startAt: nextResult.data_start,
      endAt: nextResult.data_end,
      limit: 2000,
    });

  const runBacktest = async (payload: BacktestCreateRequest): Promise<void> => {
    selectionSequence.current += 1;
    setLoadingRun(false);
    setRunning(true);
    setError(null);
    try {
      const created = await apiClient.createBacktest(payload);
      const [nextCandles, nextRuns] = await Promise.all([
        candlesFor(created),
        apiClient.getBacktestRuns(),
      ]);
      setResult(created);
      setCandles(nextCandles);
      setRuns(nextRuns);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  };

  const selectRun = async (runId: string): Promise<void> => {
    const selection = selectionSequence.current + 1;
    selectionSequence.current = selection;
    setLoadingRun(true);
    setError(null);
    try {
      const [stored, trades] = await Promise.all([
        apiClient.getBacktestResult(runId),
        apiClient.getBacktestTrades(runId),
      ]);
      if (selection !== selectionSequence.current) return;
      const nextResult = { ...stored, trades };
      const nextCandles = await candlesFor(nextResult);
      if (selection !== selectionSequence.current) return;
      setResult(nextResult);
      setCandles(nextCandles);
    } catch (reason: unknown) {
      if (selection === selectionSequence.current) {
        setError(reason instanceof Error ? reason.message : "Unknown error");
      }
    } finally {
      if (selection === selectionSequence.current) setLoadingRun(false);
    }
  };

  const selectedSymbol = symbols.find((symbol) => symbol.id === result?.symbol_id);

  return (
    <>
      <PageHeader
        badge="Deterministic engine"
        description="Configure a strategy, replay historical candles sequentially and inspect every simulated fill."
        eyebrow="Research workspace"
        title="Strategy backtesting"
      />
      {error ? <ErrorState message={error} /> : null}
      {initialLoading ? <LoadingState /> : null}
      {!initialLoading && (symbols.length === 0 || strategies.length === 0) ? (
        <section className="empty-state panel">
          <h2>Historical setup is incomplete</h2>
          <p>Add an active instrument and strategy definition before starting a backtest.</p>
        </section>
      ) : null}
      {!initialLoading && symbols.length > 0 && strategies.length > 0 ? (
        <div className="backtest-workbench">
          <aside className="backtest-sidebar">
            <BacktestForm
              busy={running}
              onSubmit={runBacktest}
              strategies={strategies}
              symbols={symbols}
            />
            <BacktestRunsTable
              busy={loadingRun || running}
              onSelect={(runId) => void selectRun(runId)}
              runs={runs}
              selectedId={result?.id ?? null}
              symbols={symbols}
            />
          </aside>

          <section className="backtest-results" aria-busy={loadingRun}>
            {loadingRun ? <LoadingState /> : null}
            {!result && !loadingRun ? (
              <div className="backtest-welcome panel">
                <span className="eyebrow">Ready for replay</span>
                <h2>Build a reproducible research baseline.</h2>
                <p>
                  Signals are calculated after a candle closes and executed at the next
                  candle open. Remaining positions are closed at the end of the dataset.
                </p>
              </div>
            ) : null}
            {result && !loadingRun ? (
              <>
                <div className="result-heading panel">
                  <div>
                    <span className="eyebrow">Completed run</span>
                    <h2>{selectedSymbol?.name ?? "Instrument"} / {result.timeframe}</h2>
                    <p>
                      {result.strategy_name} v{result.strategy_version} / {result.candle_count} candles
                    </p>
                  </div>
                  <div className="result-range">
                    <span>Data range</span>
                    <strong>{new Date(result.data_start).toLocaleString()}</strong>
                    <small>to {new Date(result.data_end).toLocaleString()}</small>
                  </div>
                </div>

                <div className="metric-grid backtest-metrics">
                  <article className="metric-card primary">
                    <span>Final balance</span>
                    <strong>{formatMoney(result.metrics.final_balance)}</strong>
                    <small><CircleDollarSign size={13} /> Start {formatMoney(result.metrics.initial_capital)}</small>
                  </article>
                  <article className="metric-card">
                    <span>Net return</span>
                    <strong className={Number(result.metrics.return_pct) >= 0 ? "positive" : "negative"}>
                      {formatPercent(result.metrics.return_pct)}
                    </strong>
                    <small><Activity size={13} /> {formatMoney(result.metrics.total_net_profit)}</small>
                  </article>
                  <article className="metric-card">
                    <span>Maximum drawdown</span>
                    <strong>{formatPercent(result.metrics.max_drawdown_pct)}</strong>
                    <small><Gauge size={13} /> Equity peak to trough</small>
                  </article>
                  <article className="metric-card">
                    <span>Win rate</span>
                    <strong>{formatPercent(result.metrics.win_rate_pct)}</strong>
                    <small><BarChart3 size={13} /> {result.metrics.total_trades} completed trades</small>
                  </article>
                </div>

                <section className="panel result-chart-panel">
                  <div className="panel-heading">
                    <div><span className="eyebrow">Portfolio path</span><h2>Equity curve</h2></div>
                    <span className="muted">Balance + mark-to-market P&amp;L</span>
                  </div>
                  <EquityChart points={result.equity_curve} />
                </section>

                <section className="panel result-chart-panel">
                  <div className="panel-heading">
                    <div><span className="eyebrow">Execution map</span><h2>Candles and trades</h2></div>
                    <span className="muted">Entries and exits never precede their signal</span>
                  </div>
                  <CandlestickTradeChart candles={candles} trades={result.trades} />
                </section>

                <div className="run-settings panel">
                  <div><span>Position size</span><strong>{result.settings.position_size}</strong></div>
                  <div><span>SL / TP</span><strong>{result.settings.stop_loss_pct ?? "off"}% / {result.settings.take_profit_pct ?? "off"}%</strong></div>
                  <div><span>Commission</span><strong>{formatMoney(result.metrics.total_commission)}</strong></div>
                  <div><span>Slippage</span><strong>{result.settings.slippage_value} {result.settings.slippage_mode === "relative" ? "bps" : "price"}</strong></div>
                  <div><span>Parameters</span><strong>{Object.entries(result.parameters).map(([key, value]) => `${key}=${String(value)}`).join(", ")}</strong></div>
                </div>

                <BacktestTradesTable trades={result.trades} />
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
