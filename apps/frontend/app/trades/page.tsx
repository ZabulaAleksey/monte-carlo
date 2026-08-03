"use client";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { usePollingQuery } from "@/hooks/use-polling-query";
import {
  deriveDataEnvironment,
  filterTradesForEnvironment,
} from "@/lib/data-environment";
import { loadTradesPageData } from "@/lib/page-data";

export default function TradesPage(): React.JSX.Element {
  const { data, error } = usePollingQuery(loadTradesPageData);
  const environment = data ? deriveDataEnvironment(data.accounts, data.mt5) : null;
  const trades = data && environment
    ? filterTradesForEnvironment(data.trades, environment)
    : null;
  const symbols = data?.symbols ?? [];

  return (
    <>
      <PageHeader eyebrow="Execution ledger" title="Trades" description="Review normalized positions imported into the analytics database." />
      {error ? <ErrorState message={error} /> : null}
      {!trades && !error ? <LoadingState /> : null}
      {trades ? (
        <section className="panel table-panel">
          <div className="panel-heading"><div><span className="eyebrow">{environment?.kind === "mt5" ? "MT5 history" : "Demo history"}</span><h2>All positions</h2></div><span className="count-badge">{trades.length} trades</span></div>
          <div className="table-scroll"><table><thead><tr><th>Ticket</th><th>Symbol</th><th>Side</th><th>Volume</th><th>Opened</th><th>Status</th><th>P&amp;L</th></tr></thead>
            <tbody>{trades.map((trade) => <tr key={trade.id}><td className="mono">{trade.external_id}</td><td><strong>{symbols.find((item) => item.id === trade.symbol_id)?.name ?? "—"}</strong></td><td><span className={`tag ${trade.side}`}>{trade.side}</span></td><td>{trade.volume}</td><td>{new Date(trade.opened_at).toLocaleString()}</td><td>{trade.status}</td><td className={Number(trade.profit) >= 0 ? "positive" : "negative"}><strong>{Number(trade.profit).toFixed(2)}</strong></td></tr>)}</tbody>
          </table></div>
          {trades.length === 0 ? <div className="panel-empty compact">No trades for the current environment.</div> : null}
        </section>
      ) : null}
    </>
  );
}
