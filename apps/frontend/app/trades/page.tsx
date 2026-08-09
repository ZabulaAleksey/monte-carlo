"use client";

import { useEffect, useState } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { useMt5Status } from "@/hooks/use-mt5-status";
import { apiClient } from "@/lib/api/client";
import type { AccountRecord, SymbolRecord, TradeRecord } from "@/lib/api/types";
import { selectEnvironmentAccount } from "@/lib/dashboard";

const REFRESH_INTERVAL_MS = 10_000;

export default function TradesPage(): React.JSX.Element {
  const { error: statusError, status } = useMt5Status();
  const connected = status?.connected === true;
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [trades, setTrades] = useState<TradeRecord[] | null>(null);
  const [symbols, setSymbols] = useState<SymbolRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = async (): Promise<void> => {
      try {
        const symbolsPromise = apiClient.getSymbols();
        const accounts = await apiClient.getAccounts();
        const nextAccount = selectEnvironmentAccount(accounts, connected);
        const tradesPromise = nextAccount
          ? apiClient.getTrades(100, nextAccount.id)
          : Promise.resolve([]);
        const [nextSymbols, nextTrades] = await Promise.all([
          symbolsPromise,
          tradesPromise,
        ]);
        if (active) {
          setAccount(nextAccount);
          setSymbols(nextSymbols);
          setTrades(
            nextAccount
              ? nextTrades.filter((trade) => trade.account_id === nextAccount.id)
              : [],
          );
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
  }, [connected]);

  const loadingStatus = status === null && statusError === null;

  return (
    <>
      <PageHeader
        eyebrow="Execution ledger"
        title="Trades"
        description={
          connected
            ? "Live executions synchronized from the connected MT5 account."
            : "MT5 is offline. Showing trades from the demo account."
        }
      />
      {error ? <ErrorState message={error} /> : null}
      {(trades === null || loadingStatus) && !error ? <LoadingState /> : null}
      {trades !== null && !loadingStatus ? (
        <section className="panel table-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                {connected ? "Live MT5 trade history" : "Demo trade history"}
              </span>
              <h2>Latest executions</h2>
              {account ? <small className="muted">{account.external_id}</small> : null}
            </div>
            <div className="market-controls">
              <span className={`source-badge ${connected ? "mt5" : "demo"}`}>
                {connected ? "MT5 online" : "Demo fallback"}
              </span>
              <span className="count-badge">{trades.length} trades</span>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Volume</th>
                  <th>Opened</th>
                  <th>Status</th>
                  <th>P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id}>
                    <td className="mono">{trade.external_id}</td>
                    <td>
                      <strong>
                        {symbols.find((item) => item.id === trade.symbol_id)?.name ?? "—"}
                      </strong>
                    </td>
                    <td><span className={`tag ${trade.side}`}>{trade.side}</span></td>
                    <td>{trade.volume}</td>
                    <td>{new Date(trade.opened_at).toLocaleString()}</td>
                    <td>{trade.status}</td>
                    <td className={Number(trade.profit) >= 0 ? "positive" : "negative"}>
                      <strong>{Number(trade.profit).toFixed(2)}</strong>
                    </td>
                  </tr>
                ))}
                {trades.length === 0 ? (
                  <tr>
                    <td className="table-empty" colSpan={7}>
                      {connected
                        ? "Waiting for MT5 trade history synchronization."
                        : "No demo trades are available."}
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
