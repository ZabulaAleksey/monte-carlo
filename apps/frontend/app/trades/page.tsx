"use client";

import { useEffect, useState } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { apiClient } from "@/lib/api/client";
import type { SymbolRecord, TradeRecord } from "@/lib/api/types";

export default function TradesPage(): React.JSX.Element {
  const [trades, setTrades] = useState<TradeRecord[] | null>(null);
  const [symbols, setSymbols] = useState<SymbolRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiClient.getTrades(), apiClient.getSymbols()])
      .then(([nextTrades, nextSymbols]) => { setTrades(nextTrades); setSymbols(nextSymbols); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unknown error"));
  }, []);

  return (
    <>
      <PageHeader eyebrow="Execution ledger" title="Trades" description="Review normalized positions imported into the analytics database." />
      {error ? <ErrorState message={error} /> : null}
      {!trades && !error ? <LoadingState /> : null}
      {trades ? (
        <section className="panel table-panel">
          <div className="panel-heading"><div><span className="eyebrow">Trade history</span><h2>All positions</h2></div><span className="count-badge">{trades.length} trades</span></div>
          <div className="table-scroll"><table><thead><tr><th>Ticket</th><th>Symbol</th><th>Side</th><th>Volume</th><th>Opened</th><th>Status</th><th>P&amp;L</th></tr></thead>
            <tbody>{trades.map((trade) => <tr key={trade.id}><td className="mono">{trade.external_id}</td><td><strong>{symbols.find((item) => item.id === trade.symbol_id)?.name ?? "—"}</strong></td><td><span className={`tag ${trade.side}`}>{trade.side}</span></td><td>{trade.volume}</td><td>{new Date(trade.opened_at).toLocaleString()}</td><td>{trade.status}</td><td className={Number(trade.profit) >= 0 ? "positive" : "negative"}><strong>{Number(trade.profit).toFixed(2)}</strong></td></tr>)}</tbody>
          </table></div>
        </section>
      ) : null}
    </>
  );
}
