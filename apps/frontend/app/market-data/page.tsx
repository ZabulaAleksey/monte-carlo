"use client";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { usePollingQuery } from "@/hooks/use-polling-query";
import {
  deriveDataEnvironment,
  filterCandlesForEnvironment,
} from "@/lib/data-environment";
import { loadMarketDataPageData } from "@/lib/page-data";

export default function MarketDataPage(): React.JSX.Element {
  const { data, error } = usePollingQuery(loadMarketDataPageData);
  const environment = data ? deriveDataEnvironment(data.accounts, data.mt5) : null;
  const candles = data && environment
    ? filterCandlesForEnvironment(data.candles, environment)
    : null;
  const symbols = data?.symbols ?? [];

  return (
    <>
      <PageHeader eyebrow="Price history" title="Market Data" description="Inspect normalized candles persisted by the platform API." />
      {error ? <ErrorState message={error} /> : null}
      {!candles && !error ? <LoadingState /> : null}
      {candles ? (
        <section className="panel table-panel">
          <div className="panel-heading"><div><span className="eyebrow">{environment?.kind === "mt5" ? "MT5 candles" : "Demo candles"}</span><h2>Latest observations</h2></div><span className="count-badge">{candles.length} rows</span></div>
          <div className="table-scroll">
            <table><thead><tr><th>Source</th><th>Symbol</th><th>Time</th><th>TF</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead>
              <tbody>{candles.map((candle) => <tr key={candle.id}><td><span className={`tag source-${candle.source}`}>{candle.source}</span></td><td><strong>{symbols.find((item) => item.id === candle.symbol_id)?.name ?? "—"}</strong></td><td>{new Date(candle.open_time).toLocaleString()}</td><td><span className="tag">{candle.timeframe}</span></td><td>{candle.open}</td><td>{candle.high}</td><td>{candle.low}</td><td>{candle.close}</td><td>{Number(candle.volume).toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
          {candles.length === 0 ? <div className="panel-empty compact">No candles for the current environment.</div> : null}
        </section>
      ) : null}
    </>
  );
}
