"use client";

import { ArrowDownRight, ArrowUpRight, Landmark, LineChart, WalletCards } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { MarketCandlestickChart } from "@/components/market-candlestick-chart";
import { Mt5ConnectionCard } from "@/components/mt5-connection-card";
import { PageHeader } from "@/components/page-header";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useMt5Status } from "@/hooks/use-mt5-status";
import {
  buildMarketSeries,
  getDashboardSource,
  selectAccountTrades,
  selectPortfolioAccount,
  selectSourceCandles,
  selectSourceQuotes,
} from "@/lib/dashboard";

const MARKET_SERIES_STORAGE_KEY = "montecarlo.dashboard.market-series.v1";

function storedMarketSeries(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MARKET_SERIES_STORAGE_KEY);
  } catch {
    return null;
  }
}

function money(value: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default function DashboardPage(): React.JSX.Element {
  const { data, error } = useDashboardData();
  const { status: mt5Status } = useMt5Status();
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(
    storedMarketSeries,
  );
  const account = selectPortfolioAccount(data?.accounts ?? []);
  const source = getDashboardSource(account);
  const accountTrades = selectAccountTrades(data?.trades ?? [], account);
  const sourceCandles = selectSourceCandles(data?.candles ?? [], source);
  const sourceQuotes = selectSourceQuotes(data?.quotes ?? [], source);
  const preferredSymbols = accountTrades.map((trade) => trade.symbol_id);
  const marketSeries = buildMarketSeries(
    sourceCandles,
    data?.symbols ?? [],
    preferredSymbols,
  );
  const activeSeries =
    marketSeries.find((series) => series.key === selectedSeriesKey) ??
    marketSeries[0] ??
    null;
  const activeQuote =
    sourceQuotes.find((quote) => quote.symbol_id === activeSeries?.symbol.id) ?? null;
  const profit = accountTrades.reduce((total, trade) => total + Number(trade.profit), 0);
  const winners = accountTrades.filter((trade) => Number(trade.profit) > 0).length;
  const winRate = accountTrades.length ? (winners / accountTrades.length) * 100 : 0;
  const balance = Number(account?.balance ?? 0);
  const sourceLabel = account?.external_id ?? "No account data";

  const selectSeries = (key: string): void => {
    setSelectedSeriesKey(key);
    try {
      window.localStorage.setItem(MARKET_SERIES_STORAGE_KEY, key);
    } catch {
      // The selection remains usable when storage is unavailable.
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Portfolio overview"
        title="Trading performance, in focus."
        description="A concise view of connected accounts, execution history and the latest market feed."
      />
      {error ? <ErrorState message={error} /> : null}
      {!data && !error ? <LoadingState /> : null}
      {data ? (
        <>
          {mt5Status ? <Mt5ConnectionCard status={mt5Status} /> : null}
          <section className="metric-grid" aria-label="Portfolio metrics">
            <article className="metric-card primary">
              <div className="metric-icon"><WalletCards size={19} /></div>
              <span>Portfolio balance</span>
              <strong>{money(balance, account?.currency)}</strong>
              <small className="metric-source">
                <span className={`source-dot ${source}`} />
                {sourceLabel}
              </small>
            </article>
            <article className="metric-card">
              <div className="metric-icon"><LineChart size={19} /></div>
              <span>Realized P&amp;L</span>
              <strong className={profit >= 0 ? "positive" : "negative"}>{money(profit)}</strong>
              <small><ArrowUpRight size={14} /> Across {accountTrades.length} account trades</small>
            </article>
            <article className="metric-card">
              <div className="metric-icon"><Landmark size={19} /></div>
              <span>Win rate</span>
              <strong>{winRate.toFixed(1)}%</strong>
              <small>{winRate >= 50 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} Closed positions</small>
            </article>
            <article className="metric-card">
              <span>Market coverage</span>
              <strong>{data.symbols.length}</strong>
              <small>{sourceCandles.length} candles loaded</small>
            </article>
          </section>
          <section className="content-grid">
            <article className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    {activeSeries
                      ? `${activeSeries.symbol.name} · ${activeSeries.timeframe}`
                      : "Waiting for candles"}
                  </span>
                  <h2>Market pulse</h2>
                </div>
                <div className="market-controls">
                  {marketSeries.length > 1 ? (
                    <select
                      aria-label="Market pulse instrument"
                      value={activeSeries?.key ?? ""}
                      onChange={(event) => selectSeries(event.target.value)}
                    >
                      {marketSeries.map((series) => (
                        <option key={series.key} value={series.key}>
                          {series.symbol.name} · {series.timeframe}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>
              {activeSeries ? (
                <>
                  <div className="live-quote-strip">
                    <div className="quote-chip bid">
                      <span>Bid</span>
                      <strong>
                        {activeQuote
                          ? Number(activeQuote.bid).toFixed(activeSeries.symbol.digits)
                          : "—"}
                      </strong>
                    </div>
                    <div className="quote-chip ask">
                      <span>Ask</span>
                      <strong>
                        {activeQuote
                          ? Number(activeQuote.ask).toFixed(activeSeries.symbol.digits)
                          : "—"}
                      </strong>
                    </div>
                    <small>
                      {activeQuote
                        ? `Live · ${new Date(activeQuote.observed_at).toLocaleTimeString()}`
                        : "Waiting for Bid/Ask"}
                    </small>
                  </div>
                  <MarketCandlestickChart
                    candles={activeSeries.candles}
                    digits={activeSeries.symbol.digits}
                    quote={activeQuote}
                    symbol={activeSeries.symbol.name}
                  />
                </>
              ) : (
                <div className="panel-empty">
                  No {source.toUpperCase()} candles have been stored yet. The dashboard
                  refreshes every 15 seconds.
                </div>
              )}
            </article>
            <article className="panel">
              <div className="panel-heading"><div><span className="eyebrow">Execution</span><h2>Recent trades</h2></div></div>
              <div className="trade-list">
                {accountTrades.slice(0, 5).map((trade) => {
                  const symbol = data.symbols.find((item) => item.id === trade.symbol_id)?.name ?? "—";
                  return (
                    <div className="trade-row" key={trade.id}>
                      <div><strong>{symbol}</strong><small>{trade.side.toUpperCase()} · {trade.volume} lots</small></div>
                      <strong className={Number(trade.profit) >= 0 ? "positive" : "negative"}>{money(Number(trade.profit))}</strong>
                    </div>
                  );
                })}
                {accountTrades.length === 0 ? (
                  <div className="panel-empty compact">No trades for the selected account.</div>
                ) : null}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </>
  );
}
