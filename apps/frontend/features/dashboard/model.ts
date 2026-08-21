import type { Mt5Status, TradeRecord } from "@/lib/api/types";
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
  type DashboardSnapshot,
} from "@/lib/dashboard";

export function buildDashboardViewModel(
  data: DashboardSnapshot,
  status: Mt5Status | null,
  selectedSeriesKey: string | null,
) {
  const account = selectPortfolioAccount(
    data.accounts,
    status?.terminal?.account_external_id,
  );
  const source = getDashboardSource(account);
  const accountTrades = selectAccountTrades(data.trades, account);
  const sourceCandles = selectSourceCandles(data.candles, source);
  const sourceQuotes = selectSourceQuotes(data.quotes, source);
  const marketSeries = buildMarketSeries(
    sourceCandles,
    data.symbols,
    accountTrades.map((trade) => trade.symbol_id),
    sourceQuotes,
  );
  const forexMarketSeries = marketSeries.filter((series) =>
    isCurrencyPairSymbol(series.symbol.name)
  );
  const selectableMarketSeries = forexMarketSeries.length > 0
    ? forexMarketSeries
    : marketSeries;
  const firstSymbolId = selectableMarketSeries[0]?.symbol.id;
  const activeSeries = selectableMarketSeries.find((series) => series.key === selectedSeriesKey)
    ?? selectableMarketSeries.find(
      (series) => series.symbol.id === firstSymbolId && series.timeframe === "H1",
    )
    ?? selectableMarketSeries[0]
    ?? null;
  const marketSymbols = [...new Map(
    selectableMarketSeries.map((series) => [series.symbol.id, series.symbol]),
  ).values()];
  const marketTimeframes = forexMarketSeries.length > 0
    ? [...MARKET_TIMEFRAMES]
    : [...new Set(selectableMarketSeries.map((series) => series.timeframe))];
  const quoteBySymbolId = new Map(sourceQuotes.map((quote) => [quote.symbol_id, quote]));
  const symbolById = new Map(data.symbols.map((symbol) => [symbol.id, symbol.name]));
  return {
    account,
    accountTrades,
    activeQuote: activeSeries ? quoteBySymbolId.get(activeSeries.symbol.id) ?? null : null,
    activeSeries,
    balance: Number(account?.balance ?? 0),
    marketSymbols,
    marketTimeframes,
    metrics: calculatePortfolioMetrics(accountTrades),
    recentTrades: accountTrades.slice(0, 5).map((trade: TradeRecord) => ({
      symbolName: symbolById.get(trade.symbol_id) ?? "—",
      trade,
    })),
    source,
    sourceCandles,
  };
}
