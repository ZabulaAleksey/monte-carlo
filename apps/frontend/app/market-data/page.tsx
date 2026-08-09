"use client";

import { useEffect, useState } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { useMt5Status } from "@/hooks/use-mt5-status";
import { apiClient } from "@/lib/api/client";
import type { CandleRecord, SymbolRecord } from "@/lib/api/types";

const REFRESH_INTERVAL_MS = 10_000;

export default function MarketDataPage(): React.JSX.Element {
  const { error: statusError, status } = useMt5Status();
  const connected = status?.connected === true;
  const source = connected ? "mt5" : "demo";
  const [symbols, setSymbols] = useState<SymbolRecord[]>([]);
  const [candles, setCandles] = useState<CandleRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = async (): Promise<void> => {
      try {
        const [nextSymbols, nextCandles] = await Promise.all([
          apiClient.getSymbols(),
          apiClient.getCandles({ limit: 100, source }),
        ]);
        if (active) {
          setSymbols(nextSymbols);
          setCandles(nextCandles.filter((candle) => candle.source === source));
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
  }, [source]);

  const loadingStatus = status === null && statusError === null;

  return (
    <>
      <PageHeader
        eyebrow="Price history"
        title="Market Data"
        description={
          connected
            ? "Live normalized candles synchronized from the connected MT5 terminal."
            : "MT5 is offline. Showing the local demo candle feed."
        }
      />
      {error ? <ErrorState message={error} /> : null}
      {(candles === null || loadingStatus) && !error ? <LoadingState /> : null}
      {candles !== null && !loadingStatus ? (
        <section className="panel table-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                {connected ? "Live MT5 candles" : "Demo candles"}
              </span>
              <h2>Latest observations</h2>
            </div>
            <div className="market-controls">
              <span className={`source-badge ${source}`}>
                {connected ? "MT5 online" : "Demo fallback"}
              </span>
              <span className="count-badge">{candles.length} rows</span>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Symbol</th>
                  <th>Time</th>
                  <th>TF</th>
                  <th>Open</th>
                  <th>High</th>
                  <th>Low</th>
                  <th>Close</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {candles.map((candle) => (
                  <tr key={candle.id}>
                    <td>
                      <span className={`tag source-${candle.source}`}>
                        {candle.source}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {symbols.find((item) => item.id === candle.symbol_id)?.name ?? "—"}
                      </strong>
                    </td>
                    <td>{new Date(candle.open_time).toLocaleString()}</td>
                    <td><span className="tag">{candle.timeframe}</span></td>
                    <td>{candle.open}</td>
                    <td>{candle.high}</td>
                    <td>{candle.low}</td>
                    <td>{candle.close}</td>
                    <td>{Number(candle.volume).toLocaleString()}</td>
                  </tr>
                ))}
                {candles.length === 0 ? (
                  <tr>
                    <td className="table-empty" colSpan={9}>
                      {connected
                        ? "Waiting for the first MT5 candle synchronization."
                        : "No demo candles are available."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
