"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import { useMt5Status } from "@/hooks/use-mt5-status";
import { apiClient } from "@/lib/api/client";
import type { CandleRecord, QuoteRecord, SymbolRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

const REFRESH_INTERVAL_MS = 10_000;

type SortDirection = "ascending" | "descending";
type QuoteSortKey = "symbol" | "bid" | "ask" | "spread" | "updated";
type CandleSortKey =
  | "source"
  | "symbol"
  | "time"
  | "timeframe"
  | "open"
  | "high"
  | "low"
  | "close"
  | "volume";

interface SortState<Key extends string> {
  direction: SortDirection;
  key: Key;
}

function compareValues(left: number | string, right: number | string): number {
  return typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right), undefined, {
        numeric: true,
        sensitivity: "base",
      });
}

function nextSort<Key extends string>(
  current: SortState<Key>,
  key: Key,
): SortState<Key> {
  return {
    key,
    direction:
      current.key === key && current.direction === "ascending"
        ? "descending"
        : "ascending",
  };
}

function SortableHeader<Key extends string>({
  active,
  direction,
  label,
  onSort,
  sortKey,
}: {
  active: boolean;
  direction: SortDirection;
  label: string;
  onSort: (key: Key) => void;
  sortKey: Key;
}): React.JSX.Element {
  return (
    <th aria-sort={active ? direction : "none"}>
      <button
        className="table-sort-button"
        onClick={() => onSort(sortKey)}
        type="button"
      >
        <span>{label}</span>
        <span aria-hidden="true">{active ? (direction === "ascending" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

export default function MarketDataPage(): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const { error: statusError, status } = useMt5Status();
  const connected = status?.connected === true;
  const source = connected ? "mt5" : "demo";
  const [symbols, setSymbols] = useState<SymbolRecord[]>([]);
  const [candles, setCandles] = useState<CandleRecord[] | null>(null);
  const [cachedQuotes, setCachedQuotes] = useState<QuoteRecord[]>([]);
  const [quoteSort, setQuoteSort] = useState<SortState<QuoteSortKey>>({
    direction: "ascending",
    key: "symbol",
  });
  const [candleSort, setCandleSort] = useState<SortState<CandleSortKey>>({
    direction: "descending",
    key: "time",
  });
  const [error, setError] = useState<string | null>(null);
  const { error: quoteError, quotes: liveQuotes } = useLiveQuotes(connected);

  useEffect(() => {
    let active = true;

    const refresh = async (): Promise<void> => {
      try {
        const [nextSymbols, nextCandles, nextQuotes] = await Promise.all([
          apiClient.getSymbols(),
          apiClient.getCandles({ limit: 100, source }),
          connected ? Promise.resolve([]) : apiClient.getQuotes(),
        ]);
        if (active) {
          setSymbols(nextSymbols);
          setCandles(nextCandles.filter((candle) => candle.source === source));
          setCachedQuotes(nextQuotes);
          setError(null);
        }
      } catch (reason: unknown) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unknown error");
        }
      }
    };

    void refresh();
    const intervalId = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [connected, source]);

  const loadingStatus = status === null && statusError === null;
  const quotes = (connected ? liveQuotes : cachedQuotes).filter(
    (quote) => quote.source === source,
  );
  const quoteRows = useMemo(
    () =>
      quotes
        .map((quote) => {
          const symbol = symbols.find((item) => item.id === quote.symbol_id);
          const digits = symbol?.digits ?? 5;
          return {
            quote,
            symbolName: symbol?.name ?? "—",
            digits,
            spread: (Number(quote.ask) - Number(quote.bid)) * 10 ** digits,
          };
        })
        .sort((left, right) => {
          const value = (row: typeof left): number | string => ({
            symbol: row.symbolName,
            bid: Number(row.quote.bid),
            ask: Number(row.quote.ask),
            spread: row.spread,
            updated: new Date(row.quote.observed_at).getTime(),
          })[quoteSort.key];
          const primary = compareValues(value(left), value(right));
          const stable = primary || left.symbolName.localeCompare(right.symbolName);
          return quoteSort.direction === "ascending" ? stable : -stable;
        }),
    [quoteSort, quotes, symbols],
  );
  const candleRows = useMemo(
    () =>
      candles === null
        ? []
        : candles
            .map((candle) => ({
              candle,
              symbolName:
                symbols.find((item) => item.id === candle.symbol_id)?.name ?? "—",
            }))
            .sort((left, right) => {
              const value = (row: typeof left): number | string => ({
                source: row.candle.source,
                symbol: row.symbolName,
                time: new Date(row.candle.open_time).getTime(),
                timeframe: row.candle.timeframe,
                open: Number(row.candle.open),
                high: Number(row.candle.high),
                low: Number(row.candle.low),
                close: Number(row.candle.close),
                volume: Number(row.candle.volume),
              })[candleSort.key];
              const primary = compareValues(value(left), value(right));
              const stable = primary || left.symbolName.localeCompare(right.symbolName);
              return candleSort.direction === "ascending" ? stable : -stable;
            }),
    [candleSort, candles, symbols],
  );
  const visibleError = error ?? quoteError;

  return (
    <>
      <PageHeader
        eyebrow={t("market.eyebrow")}
        title={t("market.title")}
        description={
          connected
            ? t("market.descriptionLive")
            : t("market.descriptionDemo")
        }
      />
      {visibleError ? <ErrorState message={visibleError} /> : null}
      {(candles === null || loadingStatus) && !visibleError ? <LoadingState /> : null}
      {candles !== null && !loadingStatus ? (
        <>
        <section className="panel table-panel live-quotes-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{t("market.quotesEyebrow")}</span>
              <h2>{t("market.allQuotes")}</h2>
              <p>{connected ? t("market.ticksActive") : t("market.ticksPaused")}</p>
            </div>
            <span className="count-badge">{t("common.rows", { count: quotes.length })}</span>
          </div>
          <div className="table-scroll">
            <table className="market-data-table quotes-table">
              <colgroup>
                <col /><col /><col /><col /><col />
              </colgroup>
              <thead>
                <tr>
                  <SortableHeader active={quoteSort.key === "symbol"} direction={quoteSort.direction} label={t("common.symbol")} onSort={(key) => setQuoteSort((current) => nextSort(current, key))} sortKey="symbol" />
                  <SortableHeader active={quoteSort.key === "bid"} direction={quoteSort.direction} label="Bid" onSort={(key) => setQuoteSort((current) => nextSort(current, key))} sortKey="bid" />
                  <SortableHeader active={quoteSort.key === "ask"} direction={quoteSort.direction} label="Ask" onSort={(key) => setQuoteSort((current) => nextSort(current, key))} sortKey="ask" />
                  <SortableHeader active={quoteSort.key === "spread"} direction={quoteSort.direction} label={t("market.spreadPoints")} onSort={(key) => setQuoteSort((current) => nextSort(current, key))} sortKey="spread" />
                  <SortableHeader active={quoteSort.key === "updated"} direction={quoteSort.direction} label={t("market.updated")} onSort={(key) => setQuoteSort((current) => nextSort(current, key))} sortKey="updated" />
                </tr>
              </thead>
              <tbody>
                {quoteRows.map(({ digits, quote, spread, symbolName }) => {
                  return (
                    <tr key={quote.symbol_id}>
                      <td><strong>{symbolName}</strong></td>
                      <td className="quote-bid">{Number(quote.bid).toFixed(digits)}</td>
                      <td className="quote-ask">{Number(quote.ask).toFixed(digits)}</td>
                      <td>{spread.toFixed(1)}</td>
                      <td>{new Date(quote.observed_at).toLocaleString(intlLocale)}</td>
                    </tr>
                  );
                })}
                {quotes.length === 0 ? (
                  <tr><td className="table-empty" colSpan={5}>{t("market.emptyQuotes")}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel table-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                {connected ? t("market.liveCandles") : t("market.demoCandles")}
              </span>
              <h2>{t("market.latest")}</h2>
            </div>
            <div className="market-controls">
              <span className={`source-badge ${source}`}>
                {connected ? t("market.online") : t("market.demoFallback")}
              </span>
              <span className="count-badge">{t("common.rows", { count: candles.length })}</span>
            </div>
          </div>
          <div className="table-scroll">
            <table className="market-data-table candles-table">
              <colgroup>
                {Array.from({ length: 9 }, (_, index) => <col key={index} />)}
              </colgroup>
              <thead>
                <tr>
                  <SortableHeader active={candleSort.key === "source"} direction={candleSort.direction} label={t("common.source")} onSort={(key) => setCandleSort((current) => nextSort(current, key))} sortKey="source" />
                  <SortableHeader active={candleSort.key === "symbol"} direction={candleSort.direction} label={t("common.symbol")} onSort={(key) => setCandleSort((current) => nextSort(current, key))} sortKey="symbol" />
                  <SortableHeader active={candleSort.key === "time"} direction={candleSort.direction} label={t("common.time")} onSort={(key) => setCandleSort((current) => nextSort(current, key))} sortKey="time" />
                  <SortableHeader active={candleSort.key === "timeframe"} direction={candleSort.direction} label={t("common.timeframe")} onSort={(key) => setCandleSort((current) => nextSort(current, key))} sortKey="timeframe" />
                  <SortableHeader active={candleSort.key === "open"} direction={candleSort.direction} label={t("common.priceOpen")} onSort={(key) => setCandleSort((current) => nextSort(current, key))} sortKey="open" />
                  <SortableHeader active={candleSort.key === "high"} direction={candleSort.direction} label={t("common.priceHigh")} onSort={(key) => setCandleSort((current) => nextSort(current, key))} sortKey="high" />
                  <SortableHeader active={candleSort.key === "low"} direction={candleSort.direction} label={t("common.priceLow")} onSort={(key) => setCandleSort((current) => nextSort(current, key))} sortKey="low" />
                  <SortableHeader active={candleSort.key === "close"} direction={candleSort.direction} label={t("common.priceClose")} onSort={(key) => setCandleSort((current) => nextSort(current, key))} sortKey="close" />
                  <SortableHeader active={candleSort.key === "volume"} direction={candleSort.direction} label={t("common.volume")} onSort={(key) => setCandleSort((current) => nextSort(current, key))} sortKey="volume" />
                </tr>
              </thead>
              <tbody>
                {candleRows.map(({ candle, symbolName }) => (
                  <tr key={candle.id}>
                    <td>
                      <span className={`tag source-${candle.source}`}>
                        {candle.source === "mt5" ? t("common.mt5") : t("common.demo")}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {symbolName}
                      </strong>
                    </td>
                    <td>{new Date(candle.open_time).toLocaleString(intlLocale)}</td>
                    <td><span className="tag">{candle.timeframe}</span></td>
                    <td>{candle.open}</td>
                    <td>{candle.high}</td>
                    <td>{candle.low}</td>
                    <td>{candle.close}</td>
                    <td>{Number(candle.volume).toLocaleString(intlLocale)}</td>
                  </tr>
                ))}
                {candles.length === 0 ? (
                  <tr>
                    <td className="table-empty" colSpan={9}>
                      {connected
                        ? t("market.emptyLive")
                        : t("market.emptyDemo")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        </>
      ) : null}
    </>
  );
}
