"use client";

import { useEffect, useState } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { apiClient } from "@/lib/api/client";
import type { CandleRecord, SymbolRecord } from "@/lib/api/types";

export default function MarketDataPage(): React.JSX.Element {
  const [symbols, setSymbols] = useState<SymbolRecord[]>([]);
  const [candles, setCandles] = useState<CandleRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiClient.getSymbols(), apiClient.getCandles(100)])
      .then(([nextSymbols, nextCandles]) => { setSymbols(nextSymbols); setCandles(nextCandles); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unknown error"));
  }, []);

  return (
    <>
      <PageHeader eyebrow="Price history" title="Market Data" description="Inspect normalized candles persisted by the platform API." />
      {error ? <ErrorState message={error} /> : null}
      {!candles && !error ? <LoadingState /> : null}
      {candles ? (
        <section className="panel table-panel">
          <div className="panel-heading"><div><span className="eyebrow">Stored candles</span><h2>Latest observations</h2></div><span className="count-badge">{candles.length} rows</span></div>
          <div className="table-scroll">
            <table><thead><tr><th>Source</th><th>Symbol</th><th>Time</th><th>TF</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead>
              <tbody>{candles.map((candle) => <tr key={candle.id}><td><span className={`tag source-${candle.source}`}>{candle.source}</span></td><td><strong>{symbols.find((item) => item.id === candle.symbol_id)?.name ?? "—"}</strong></td><td>{new Date(candle.open_time).toLocaleString()}</td><td><span className="tag">{candle.timeframe}</span></td><td>{candle.open}</td><td>{candle.high}</td><td>{candle.low}</td><td>{candle.close}</td><td>{Number(candle.volume).toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
