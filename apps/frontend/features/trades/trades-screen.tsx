"use client";

import { useMemo } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { useMt5Status } from "@/hooks/use-mt5-status";
import { usePollingQuery } from "@/hooks/use-polling-query";
import { apiClient } from "@/lib/api/client";
import type {
  AccountRecord,
  PositionRecord,
  SymbolRecord,
  TradeRecord,
} from "@/lib/api/types";
import { selectEnvironmentAccount } from "@/lib/data-environment";
import { useI18n } from "@/lib/i18n";
import { buildExecutionRows } from "./model";

const REFERENCE_REFRESH_INTERVAL_MS = 15_000;
const TRADE_REFRESH_INTERVAL_MS = 2_000;
const POSITION_REFRESH_INTERVAL_MS = 500;
const EMPTY_POSITIONS: PositionRecord[] = [];
const EMPTY_SYMBOLS: SymbolRecord[] = [];
const EMPTY_TRADES: TradeRecord[] = [];

export function TradesScreen(): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const { error: statusError, status } = useMt5Status();
  const connected = status?.connected === true;
  const reference = usePollingQuery<{
    account: AccountRecord | null;
    connected: boolean;
    symbols: SymbolRecord[];
  }>({
    intervalMs: REFERENCE_REFRESH_INTERVAL_MS,
    queryKey: connected,
    loader: async () => {
      const [accounts, symbols] = await Promise.all([
        apiClient.getAccounts(),
        apiClient.getSymbols(),
      ]);
      return { account: selectEnvironmentAccount(accounts, connected), connected, symbols };
    },
  });
  const currentReference = reference.data?.connected === connected ? reference.data : null;
  const account = currentReference?.account ?? null;
  const symbols = currentReference?.symbols ?? EMPTY_SYMBOLS;
  const tradesQuery = usePollingQuery<{ accountId: string; rows: TradeRecord[] }>({
    enabled: account !== null,
    intervalMs: TRADE_REFRESH_INTERVAL_MS,
    queryKey: account?.id ?? null,
    loader: async () => ({
      accountId: account?.id ?? "",
      rows: (await apiClient.getTrades(100, account?.id)).filter(
        (trade) => trade.account_id === account?.id,
      ),
    }),
  });
  const positionsQuery = usePollingQuery<{ accountId: string; rows: PositionRecord[] }>({
    enabled: account !== null,
    intervalMs: POSITION_REFRESH_INTERVAL_MS,
    queryKey: account?.id ?? null,
    loader: async () => ({
      accountId: account?.id ?? "",
      rows: (await apiClient.getPositions(account?.id)).filter(
        (position) => position.account_id === account?.id,
      ),
    }),
  });
  const trades = account === null
    ? EMPTY_TRADES
    : tradesQuery.data?.accountId === account.id ? tradesQuery.data.rows : null;
  const positions = account === null
    ? EMPTY_POSITIONS
    : positionsQuery.data?.accountId === account.id ? positionsQuery.data.rows : null;
  const error = reference.error ?? tradesQuery.error ?? positionsQuery.error;

  const executionRows = useMemo(
    () => buildExecutionRows(positions ?? [], trades ?? [], symbols),
    [positions, trades, symbols],
  );

  const loadingStatus = status === null && statusError === null;
  const loadingData = trades === null || positions === null;

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
      {(loadingData || loadingStatus) && !error ? <LoadingState /> : null}
      {!loadingData && !loadingStatus ? (
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
              <span className="count-badge">{t("common.trades", { count: executionRows.length })}</span>
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
                {executionRows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.externalId}</td>
                    <td>
                      <strong>
                        {row.symbolName}
                      </strong>
                    </td>
                    <td>
                      <span className={`tag ${row.side}`}>
                        {row.side === "buy" ? t("common.buy") : t("common.sell")}
                      </span>
                    </td>
                    <td>{row.volume}</td>
                    <td>{new Date(row.openedAt).toLocaleString(intlLocale)}</td>
                    <td>
                      {row.status === "closed"
                        ? t("common.closed")
                        : row.status === "open"
                          ? t("common.open")
                          : row.status}
                    </td>
                    <td className={row.pnl >= 0 ? "positive" : "negative"}>
                      <strong>{row.pnl.toFixed(2)}</strong>
                    </td>
                  </tr>
                ))}
                {executionRows.length === 0 ? (
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
