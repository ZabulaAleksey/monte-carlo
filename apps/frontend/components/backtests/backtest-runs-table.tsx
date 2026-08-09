import type { BacktestRunSummary, SymbolRecord } from "@/lib/api/types";
import { formatMoney, formatPercent } from "@/lib/backtests";

interface BacktestRunsTableProps {
  busy: boolean;
  runs: BacktestRunSummary[];
  selectedId: string | null;
  symbols: SymbolRecord[];
  onSelect: (runId: string) => void;
}

export function BacktestRunsTable({
  busy,
  runs,
  selectedId,
  symbols,
  onSelect,
}: BacktestRunsTableProps): React.JSX.Element {
  return (
    <section className="panel table-panel backtest-runs">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Saved research</span>
          <h2>Previous runs</h2>
        </div>
        <span className="count-badge">{runs.length} runs</span>
      </div>
      {runs.length === 0 ? (
        <div className="panel-empty compact">Your completed runs will appear here.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Market</th>
                <th>Return</th>
                <th>Final</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr className={run.id === selectedId ? "selected-row" : undefined} key={run.id}>
                  <td>
                    <button
                      className="table-link"
                      disabled={busy}
                      onClick={() => onSelect(run.id)}
                      type="button"
                    >
                      {new Date(run.created_at).toLocaleString()}
                    </button>
                    <small>v{run.strategy_version}</small>
                  </td>
                  <td>
                    {symbols.find((item) => item.id === run.symbol_id)?.name ?? "Unknown"} / {run.timeframe}
                  </td>
                  <td className={Number(run.return_pct) >= 0 ? "positive" : "negative"}>
                    {formatPercent(run.return_pct)}
                  </td>
                  <td className="mono">{formatMoney(run.final_balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
