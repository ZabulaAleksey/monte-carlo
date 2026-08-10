"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { useMt5Status } from "@/hooks/use-mt5-status";
import { apiClient } from "@/lib/api/client";
import type {
  AccountRecord,
  PositionRecord,
  SymbolRecord,
  TradeRecord,
  TradeSide,
  TradeStatus,
} from "@/lib/api/types";
import { selectEnvironmentAccount } from "@/lib/dashboard";
import { useI18n } from "@/lib/i18n";

const REFERENCE_REFRESH_INTERVAL_MS = 15_000;
const TRADE_REFRESH_INTERVAL_MS = 2_000;
const POSITION_REFRESH_INTERVAL_MS = 500;

interface ExecutionRow {
  id: string;
  externalId: string;
  symbolId: string;
  side: TradeSide;
  volume: string;
  openedAt: string;
  status: TradeStatus;
  pnl: number;
}

function isLegacyEntryExecution(trade: TradeRecord): boolean {
  return (
    trade.status === "closed" &&
    trade.closed_at === trade.opened_at &&
    trade.close_price === trade.open_price &&
    Number(trade.profit) === 0
  );
}

export default function TradesPage(): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const { error: statusError, status } = useMt5Status();
  const connected = status?.connected === true;
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [trades, setTrades] = useState<TradeRecord[] | null>(null);
  const [positions, setPositions] = useState<PositionRecord[] | null>(null);
  const [symbols, setSymbols] = useState<SymbolRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    let inFlight = false;

    const refresh = async (): Promise<void> => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const [accounts, nextSymbols] = await Promise.all([
          apiClient.getAccounts(),
          apiClient.getSymbols(),
        ]);
        const nextAccount = selectEnvironmentAccount(accounts, connected);
        if (active) {
          setAccount(nextAccount);
          setSymbols(nextSymbols);
          setError(null);
        }
      } catch (reason: unknown) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unknown error");
        }
      } finally {
        inFlight = false;
      }
    };

    void refresh();
    const intervalId = window.setInterval(
      () => void refresh(),
      REFERENCE_REFRESH_INTERVAL_MS,
    );
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [connected]);

  useEffect(() => {
    if (!account) {
      setTrades([]);
      return;
    }
    let active = true;
    let inFlight = false;

    const refreshTrades = async (): Promise<void> => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const nextTrades = await apiClient.getTrades(100, account.id);
        if (active) {
          setTrades(nextTrades.filter((trade) => trade.account_id === account.id));
          setError(null);
        }
      } catch (reason: unknown) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unknown error");
        }
      } finally {
        inFlight = false;
      }
    };

    void refreshTrades();
    const intervalId = window.setInterval(
      () => void refreshTrades(),
      TRADE_REFRESH_INTERVAL_MS,
    );
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [account]);

  useEffect(() => {
    if (!account) {
      setPositions([]);
      return;
    }
    let active = true;
    let inFlight = false;

    const refreshPositions = async (): Promise<void> => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const nextPositions = await apiClient.getPositions(account.id);
        if (active) {
          setPositions(
            nextPositions.filter((position) => position.account_id === account.id),
          );
          setError(null);
        }
      } catch (reason: unknown) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unknown error");
        }
      } finally {
        inFlight = false;
      }
    };

    void refreshPositions();
    const intervalId = window.setInterval(
      () => void refreshPositions(),
      POSITION_REFRESH_INTERVAL_MS,
    );
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [account]);

  const symbolNames = useMemo(
    () => new Map(symbols.map((symbol) => [symbol.id, symbol.name])),
    [symbols],
  );
  const executionRows = useMemo<ExecutionRow[]>(() => {
    const openRows = (positions ?? []).map((position) => ({
      id: `position:${position.id}`,
      externalId: position.external_id,
      symbolId: position.symbol_id,
      side: position.side,
      volume: position.volume,
      openedAt: position.opened_at,
      status: position.status,
      pnl: Number(position.profit) + Number(position.swap),
    }));
    const closedRows = (trades ?? [])
      .filter((trade) => !isLegacyEntryExecution(trade))
      .map((trade) => ({
        id: `trade:${trade.id}`,
        externalId: trade.external_id,
        symbolId: trade.symbol_id,
        side: trade.side,
        volume: trade.volume,
        openedAt: trade.opened_at,
        status: trade.status,
        pnl: Number(trade.profit) + Number(trade.commission) + Number(trade.swap),
      }));
    return [...openRows, ...closedRows].sort(
      (left, right) => Date.parse(right.openedAt) - Date.parse(left.openedAt),
    );
  }, [positions, trades]);

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
                        {symbolNames.get(row.symbolId) ?? "—"}
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
