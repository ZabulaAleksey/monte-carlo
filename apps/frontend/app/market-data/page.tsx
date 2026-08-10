"use client";

import { useEffect, useState } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import { useMt5Status } from "@/hooks/use-mt5-status";
import { apiClient } from "@/lib/api/client";
import type { CandleRecord, QuoteRecord, SymbolRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

const REFRESH_INTERVAL_MS = 10_000;

export default function MarketDataPage(): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const { error: statusError, status } = useMt5Status();
  const connected = status?.connected === true;
  const source = connected ? "mt5" : "demo";
  const [symbols, setSymbols] = useState<SymbolRecord[]>([]);
  const [candles, setCandles] = useState<CandleRecord[] | null>(null);
  const [cachedQuotes, setCachedQuotes] = useState<QuoteRecord[]>([]);
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
            <table>
              <thead>
                <tr>
                  <th>{t("common.symbol")}</th>
                  <th>Bid</th>
                  <th>Ask</th>
                  <th>{t("market.spreadPoints")}</th>
                  <th>{t("market.updated")}</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => {
                  const symbol = symbols.find((item) => item.id === quote.symbol_id);
                  const digits = symbol?.digits ?? 5;
                  const spread = (Number(quote.ask) - Number(quote.bid)) * 10 ** digits;
                  return (
                    <tr key={quote.symbol_id}>
                      <td><strong>{symbol?.name ?? "—"}</strong></td>
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
            <table>
              <thead>
                <tr>
                  <th>{t("common.source")}</th>
                  <th>{t("common.symbol")}</th>
                  <th>{t("common.time")}</th>
                  <th>{t("common.timeframe")}</th>
                  <th>{t("common.priceOpen")}</th>
                  <th>{t("common.priceHigh")}</th>
                  <th>{t("common.priceLow")}</th>
                  <th>{t("common.priceClose")}</th>
                  <th>{t("common.volume")}</th>
                </tr>
              </thead>
              <tbody>
                {candles.map((candle) => (
                  <tr key={candle.id}>
                    <td>
                      <span className={`tag source-${candle.source}`}>
                        {candle.source === "mt5" ? t("common.mt5") : t("common.demo")}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {symbols.find((item) => item.id === candle.symbol_id)?.name ?? "—"}
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
