"use client";

import { ArrowDownRight, ArrowUpRight, Landmark, LineChart, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { apiClient } from "@/lib/api/client";
import type { AccountRecord, CandleRecord, SymbolRecord, TradeRecord } from "@/lib/api/types";

interface DashboardData {
  accounts: AccountRecord[];
  candles: CandleRecord[];
  symbols: SymbolRecord[];
  trades: TradeRecord[];
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function DashboardPage(): React.JSX.Element {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.getAccounts(),
      apiClient.getCandles(),
      apiClient.getSymbols(),
      apiClient.getTrades(),
    ])
      .then(([accounts, candles, symbols, trades]) => {
        if (active) setData({ accounts, candles, symbols, trades });
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unknown error");
      });
    return () => {
      active = false;
    };
  }, []);

  const profit = data?.trades.reduce((total, trade) => total + Number(trade.profit), 0) ?? 0;
  const winners = data?.trades.filter((trade) => Number(trade.profit) > 0).length ?? 0;
  const winRate = data?.trades.length ? (winners / data.trades.length) * 100 : 0;
  const balance = data?.accounts.reduce((total, account) => total + Number(account.balance), 0) ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Portfolio overview"
        title="Trading performance, in focus."
        description="A concise view of connected accounts, execution history and the latest market feed."
      />
      {error ? <ErrorState message={error} /> : null}
      {!data && !error ? <LoadingState /> : null}
      {data ? (
        <>
          <section className="metric-grid" aria-label="Portfolio metrics">
            <article className="metric-card primary">
              <div className="metric-icon"><WalletCards size={19} /></div>
              <span>Portfolio balance</span>
              <strong>{money(balance)}</strong>
              <small><ArrowUpRight size={14} /> Demo account equity</small>
            </article>
            <article className="metric-card">
              <div className="metric-icon"><LineChart size={19} /></div>
              <span>Realized P&amp;L</span>
              <strong className={profit >= 0 ? "positive" : "negative"}>{money(profit)}</strong>
              <small><ArrowUpRight size={14} /> Across {data.trades.length} trades</small>
            </article>
            <article className="metric-card">
              <div className="metric-icon"><Landmark size={19} /></div>
              <span>Win rate</span>
              <strong>{winRate.toFixed(1)}%</strong>
              <small>{winRate >= 50 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} Closed positions</small>
            </article>
            <article className="metric-card">
              <span>Market coverage</span>
              <strong>{data.symbols.length}</strong>
              <small>{data.candles.length} recent candles loaded</small>
            </article>
          </section>
          <section className="content-grid">
            <article className="panel chart-panel">
              <div className="panel-heading">
                <div><span className="eyebrow">EURUSD · H1</span><h2>Market pulse</h2></div>
                <span className="muted">Last {Math.min(data.candles.length, 24)} periods</span>
              </div>
              <div className="mini-chart" aria-label="Recent close price visualization">
                {data.candles.slice(0, 24).reverse().map((candle, index) => {
                  const range = Number(candle.high) - Number(candle.low) || 1;
                  const body = Math.abs(Number(candle.close) - Number(candle.open));
                  const height = Math.max(14, Math.min(88, (body / range) * 100));
                  return <span className={Number(candle.close) >= Number(candle.open) ? "bar up" : "bar down"} key={candle.id} style={{ height: `${height}%` }} title={`Period ${index + 1}: ${candle.close}`} />;
                })}
              </div>
            </article>
            <article className="panel">
              <div className="panel-heading"><div><span className="eyebrow">Execution</span><h2>Recent trades</h2></div></div>
              <div className="trade-list">
                {data.trades.slice(0, 5).map((trade) => {
                  const symbol = data.symbols.find((item) => item.id === trade.symbol_id)?.name ?? "—";
                  return (
                    <div className="trade-row" key={trade.id}>
                      <div><strong>{symbol}</strong><small>{trade.side.toUpperCase()} · {trade.volume} lots</small></div>
                      <strong className={Number(trade.profit) >= 0 ? "positive" : "negative"}>{money(Number(trade.profit))}</strong>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </>
  );
}
