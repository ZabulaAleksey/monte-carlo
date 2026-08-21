import type { VirtualTradeRecord } from "@/lib/api/types";
import { formatMoney } from "@/lib/backtests";
import { useI18n } from "@/lib/i18n";

interface BacktestTradesTableProps {
  animationEnabled?: boolean;
  trades: VirtualTradeRecord[];
  visibleBefore?: string;
}

export function BacktestTradesTable({
  animationEnabled = false,
  trades,
  visibleBefore,
}: BacktestTradesTableProps): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const cutoff = animationEnabled && visibleBefore
    ? new Date(visibleBefore).getTime()
    : Number.POSITIVE_INFINITY;
  const visibleTrades = trades.filter(
    (trade) => new Date(trade.opened_at).getTime() < cutoff,
  );
  const isScrollable = visibleTrades.length > 10;
  const exitReason = (reason: VirtualTradeRecord["exit_reason"]): string => ({
    signal: t("trade.reason.signal"),
    reverse: t("trade.reason.reverse"),
    stop_loss: t("trade.reason.stop_loss"),
    take_profit: t("trade.reason.take_profit"),
    bankruptcy: t("trade.reason.bankruptcy"),
    end_of_data: t("trade.reason.end_of_data"),
  })[reason];
  return (
    <section className="panel table-panel backtest-trades">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{t("trades.eyebrow")}</span>
          <h2>{t("trades.title")}</h2>
        </div>
        <span className="count-badge">{t("trades.count", { count: visibleTrades.length })}</span>
      </div>
      {visibleTrades.length === 0 ? (
        <div className="panel-empty compact">
          {animationEnabled && trades.length > 0 ? t("trades.waitingReplay") : t("trades.empty")}
        </div>
      ) : (
        <div className={`table-scroll backtest-trades-scroll${isScrollable ? " is-scrollable" : ""}`}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t("trades.side")}</th>
                <th>{t("trades.opened")}</th>
                <th>{t("trades.closed")}</th>
                <th>{t("trades.entry")}</th>
                <th>{t("trades.exit")}</th>
                <th>{t("trades.reason")}</th>
                <th>{t("trades.costs")}</th>
                <th>{t("trades.pnl")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleTrades.map((trade) => {
                const closed = new Date(trade.closed_at).getTime() < cutoff;
                return (
                <tr className={closed ? undefined : "replay-open-trade"} key={trade.sequence}>
                  <td className="mono">{trade.sequence}</td>
                  <td>
                    <span className={`tag ${trade.side}`}>
                      {trade.side === "buy" ? t("common.buy") : t("common.sell")}
                    </span>
                  </td>
                  <td>{new Date(trade.opened_at).toLocaleString(intlLocale)}</td>
                  <td>{closed ? new Date(trade.closed_at).toLocaleString(intlLocale) : t("common.open")}</td>
                  <td className="mono">{trade.open_price}</td>
                  <td className="mono">{closed ? trade.close_price : "-"}</td>
                  <td>{closed ? exitReason(trade.exit_reason) : "-"}</td>
                  <td className="mono">{closed ? formatMoney(Number(trade.commission) - Number(trade.swap), intlLocale) : "-"}</td>
                  <td className={closed ? (Number(trade.net_profit) >= 0 ? "positive mono" : "negative mono") : "mono"}>
                    {closed ? formatMoney(trade.net_profit, intlLocale) : "-"}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
