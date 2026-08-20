"use client";

import { ArrowDownRight, ArrowUpRight, Landmark, LineChart, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { MarketCandlestickChart } from "@/components/market-candlestick-chart";
import { Mt5ConnectionCard } from "@/components/mt5-connection-card";
import { PageHeader } from "@/components/page-header";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useMt5Status } from "@/hooks/use-mt5-status";
import {
  buildMarketSeries,
  calculatePortfolioMetrics,
  getDashboardSource,
  isCurrencyPairSymbol,
  MARKET_TIMEFRAMES,
  selectAccountTrades,
  selectPortfolioAccount,
  selectSourceCandles,
  selectSourceQuotes,
} from "@/lib/dashboard";
import { useI18n } from "@/lib/i18n";

const MARKET_SERIES_STORAGE_KEY = "montecarlo.dashboard.market-series.v1";

function storedMarketSeries(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MARKET_SERIES_STORAGE_KEY);
  } catch {
    return null;
  }
}

function money(value: number, locale: string, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default function DashboardPage(): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const { data, error, loadCandles } = useDashboardData();
  const { status: mt5Status } = useMt5Status();
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(
    storedMarketSeries,
  );
  const account = selectPortfolioAccount(
    data?.accounts ?? [],
    mt5Status?.terminal?.account_external_id,
  );
  const source = getDashboardSource(account);
  const accountTrades = useMemo(
    () => selectAccountTrades(data?.trades ?? [], account),
    [data?.trades, account],
  );
  const sourceCandles = useMemo(
    () => selectSourceCandles(data?.candles ?? [], source),
    [data?.candles, source],
  );
  const sourceQuotes = useMemo(
    () => selectSourceQuotes(data?.quotes ?? [], source),
    [data?.quotes, source],
  );
  const preferredSymbols = useMemo(
    () => accountTrades.map((trade) => trade.symbol_id),
    [accountTrades],
  );
  const marketSeries = useMemo(
    () => buildMarketSeries(
      sourceCandles,
      data?.symbols ?? [],
      preferredSymbols,
      sourceQuotes,
    ),
    [sourceCandles, data?.symbols, preferredSymbols, sourceQuotes],
  );
  const forexMarketSeries = useMemo(
    () => marketSeries.filter((series) => isCurrencyPairSymbol(series.symbol.name)),
    [marketSeries],
  );
  const selectableMarketSeries = forexMarketSeries.length > 0
    ? forexMarketSeries
    : marketSeries;
  const firstSymbolId = selectableMarketSeries[0]?.symbol.id;
  const activeSeries =
    selectableMarketSeries.find((series) => series.key === selectedSeriesKey) ??
    selectableMarketSeries.find(
      (series) => series.symbol.id === firstSymbolId && series.timeframe === "H1",
    ) ??
    selectableMarketSeries[0] ??
    null;
  const marketSymbols = useMemo(
    () => [...new Map(
      selectableMarketSeries.map((series) => [series.symbol.id, series.symbol]),
    ).values()],
    [selectableMarketSeries],
  );
  const marketTimeframes = forexMarketSeries.length > 0
    ? MARKET_TIMEFRAMES
    : [...new Set(selectableMarketSeries.map((series) => series.timeframe))];
  const activeQuote =
    sourceQuotes.find((quote) => quote.symbol_id === activeSeries?.symbol.id) ?? null;
  const activeSeriesSymbolId = activeSeries?.symbol.id ?? null;
  const activeSeriesTimeframe = activeSeries?.timeframe ?? null;
  const activeSeriesNeedsCandles = activeSeries?.candles.length === 0;
  const metrics = useMemo(
    () => calculatePortfolioMetrics(accountTrades),
    [accountTrades],
  );
  const balance = Number(account?.balance ?? 0);
  const sourceLabel = account?.external_id ?? t("dashboard.noAccount");
  const translatedSource = source === "mt5" ? t("common.mt5") : t("common.demo");

  useEffect(() => {
    if (activeSeriesSymbolId && activeSeriesTimeframe && activeSeriesNeedsCandles) {
      void loadCandles(activeSeriesSymbolId, activeSeriesTimeframe);
    }
  }, [
    activeSeriesNeedsCandles,
    activeSeriesSymbolId,
    activeSeriesTimeframe,
    loadCandles,
  ]);

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
        eyebrow={t("dashboard.eyebrow")}
        title={t("dashboard.title")}
        description={t("dashboard.description")}
      />
      {error ? <ErrorState message={error} /> : null}
      {!data && !error ? <LoadingState /> : null}
      {data ? (
        <>
          {mt5Status ? <Mt5ConnectionCard status={mt5Status} /> : null}
          <section className="metric-grid" aria-label={t("dashboard.metrics")}>
            <article className="metric-card primary">
              <div className="metric-icon"><WalletCards size={19} /></div>
              <span>{t("dashboard.balance")}</span>
              <strong>{money(balance, intlLocale, account?.currency)}</strong>
              <small className="metric-source">
                <span className={`source-dot ${source}`} />
                {sourceLabel}
              </small>
            </article>
            <article className="metric-card">
              <div className="metric-icon"><LineChart size={19} /></div>
              <span>{t("dashboard.realized")}</span>
              <strong className={metrics.realizedNetProfit >= 0 ? "positive" : "negative"}>{money(metrics.realizedNetProfit, intlLocale)}</strong>
              <small><ArrowUpRight size={14} /> {t("dashboard.acrossTrades", { count: metrics.closedTrades })}</small>
            </article>
            <article className="metric-card">
              <div className="metric-icon"><Landmark size={19} /></div>
              <span>{t("dashboard.winRate")}</span>
              <strong>{metrics.winRate.toFixed(1)}%</strong>
              <small>{metrics.winRate >= 50 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {t("dashboard.closedPositions")}</small>
            </article>
            <article className="metric-card">
              <span>{t("dashboard.marketCoverage")}</span>
              <strong>{data.symbols.length}</strong>
              <small>{t("dashboard.candlesLoaded", { count: sourceCandles.length })}</small>
            </article>
          </section>
          <section className="content-grid">
            <article className="panel chart-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    {activeSeries
                      ? `${activeSeries.symbol.name} · ${activeSeries.timeframe}`
                      : t("dashboard.waitingCandles")}
                  </span>
                  <h2>{t("dashboard.marketPulse")}</h2>
                </div>
                <div className="market-controls">
                  {marketSymbols.length > 0 ? (
                    <select
                      aria-label={t("dashboard.marketInstrument")}
                      value={activeSeries?.symbol.id ?? ""}
                      onChange={(event) => selectSeries(
                        `${event.target.value}:${activeSeries?.timeframe ?? "H1"}`,
                      )}
                    >
                      {marketSymbols.map((symbol) => (
                        <option key={symbol.id} value={symbol.id}>
                          {symbol.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {marketTimeframes.length > 0 ? (
                    <select
                      aria-label={t("dashboard.marketTimeframe")}
                      value={activeSeries?.timeframe ?? ""}
                      onChange={(event) => selectSeries(
                        `${activeSeries?.symbol.id ?? ""}:${event.target.value}`,
                      )}
                    >
                      {marketTimeframes.map((timeframe) => (
                        <option key={timeframe} value={timeframe}>{timeframe}</option>
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
                        ? t("dashboard.liveQuote", {
                            time: new Date(activeQuote.observed_at).toLocaleTimeString(intlLocale),
                          })
                        : t("dashboard.waitingBidAsk")}
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
                  {t("dashboard.noCandles", { source: translatedSource })}
                </div>
              )}
            </article>
            <article className="panel">
              <div className="panel-heading"><div><span className="eyebrow">{t("dashboard.execution")}</span><h2>{t("dashboard.recentTrades")}</h2></div></div>
              <div className="trade-list">
                {accountTrades.slice(0, 5).map((trade) => {
                  const symbol = data.symbols.find((item) => item.id === trade.symbol_id)?.name ?? "—";
                  const side = trade.side === "buy" ? t("common.buy") : t("common.sell");
                  return (
                    <div className="trade-row" key={trade.id}>
                      <div><strong>{symbol}</strong><small>{t("dashboard.tradeVolume", { side, volume: trade.volume })}</small></div>
                      <strong className={Number(trade.profit) >= 0 ? "positive" : "negative"}>{money(Number(trade.profit), intlLocale)}</strong>
                    </div>
                  );
                })}
                {accountTrades.length === 0 ? (
                  <div className="panel-empty compact">{t("dashboard.noTrades")}</div>
                ) : null}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </>
  );
}
