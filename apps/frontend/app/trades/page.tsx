"use client";

import { useEffect, useState } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { useMt5Status } from "@/hooks/use-mt5-status";
import { apiClient } from "@/lib/api/client";
import type { AccountRecord, SymbolRecord, TradeRecord } from "@/lib/api/types";
import { selectEnvironmentAccount } from "@/lib/dashboard";
import { useI18n } from "@/lib/i18n";

const REFRESH_INTERVAL_MS = 10_000;

export default function TradesPage(): React.JSX.Element {
  const { intlLocale, t } = useI18n();
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
        eyebrow={t("liveTrades.eyebrow")}
        title={t("liveTrades.title")}
        description={
          connected
            ? t("liveTrades.descriptionLive")
            : t("liveTrades.descriptionDemo")
        }
      />
      {error ? <ErrorState message={error} /> : null}
      {(trades === null || loadingStatus) && !error ? <LoadingState /> : null}
      {trades !== null && !loadingStatus ? (
        <section className="panel table-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                {connected ? t("liveTrades.historyLive") : t("liveTrades.historyDemo")}
              </span>
              <h2>{t("liveTrades.latest")}</h2>
              {account ? <small className="muted">{account.external_id}</small> : null}
            </div>
            <div className="market-controls">
              <span className={`source-badge ${connected ? "mt5" : "demo"}`}>
                {connected ? t("market.online") : t("market.demoFallback")}
              </span>
              <span className="count-badge">{t("common.trades", { count: trades.length })}</span>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("common.ticket")}</th>
                  <th>{t("common.symbol")}</th>
                  <th>{t("trades.side")}</th>
                  <th>{t("common.volume")}</th>
                  <th>{t("trades.opened")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.pnl")}</th>
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
                    <td>
                      <span className={`tag ${trade.side}`}>
                        {trade.side === "buy" ? t("common.buy") : t("common.sell")}
                      </span>
                    </td>
                    <td>{trade.volume}</td>
                    <td>{new Date(trade.opened_at).toLocaleString(intlLocale)}</td>
                    <td>
                      {trade.status === "closed"
                        ? t("common.closed")
                        : trade.status === "open"
                          ? t("common.open")
                          : trade.status}
                    </td>
                    <td className={Number(trade.profit) >= 0 ? "positive" : "negative"}>
                      <strong>{Number(trade.profit).toFixed(2)}</strong>
                    </td>
                  </tr>
                ))}
                {trades.length === 0 ? (
                  <tr>
                    <td className="table-empty" colSpan={7}>
                      {connected
                        ? t("liveTrades.emptyLive")
                        : t("liveTrades.emptyDemo")}
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
