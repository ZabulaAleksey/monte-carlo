import type { VirtualTradeRecord } from "@/lib/api/types";
import { formatMoney } from "@/lib/backtests";

interface BacktestTradesTableProps {
  trades: VirtualTradeRecord[];
}

export function BacktestTradesTable({
  trades,
}: BacktestTradesTableProps): React.JSX.Element {
  return (
    <section className="panel table-panel backtest-trades">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Virtual execution</span>
          <h2>Trade ledger</h2>
        </div>
        <span className="count-badge">{trades.length} trades</span>
      </div>
      {trades.length === 0 ? (
        <div className="panel-empty compact">The strategy produced no completed trades.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Side</th>
                <th>Opened</th>
                <th>Closed</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>Reason</th>
                <th>Costs</th>
                <th>Net P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.sequence}>
                  <td className="mono">{trade.sequence}</td>
                  <td><span className={`tag ${trade.side}`}>{trade.side}</span></td>
                  <td>{new Date(trade.opened_at).toLocaleString()}</td>
                  <td>{new Date(trade.closed_at).toLocaleString()}</td>
                  <td className="mono">{trade.open_price}</td>
                  <td className="mono">{trade.close_price}</td>
                  <td>{trade.exit_reason.replaceAll("_", " ")}</td>
                  <td className="mono">{formatMoney(Number(trade.commission) - Number(trade.swap))}</td>
                  <td className={Number(trade.net_profit) >= 0 ? "positive mono" : "negative mono"}>
                    {formatMoney(trade.net_profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
