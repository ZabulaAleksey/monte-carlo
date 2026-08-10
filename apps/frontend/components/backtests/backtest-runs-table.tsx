import { Trash2 } from "lucide-react";

import type { BacktestRunSummary, SymbolRecord } from "@/lib/api/types";
import { formatMoney, formatPercent } from "@/lib/backtests";
import { useI18n } from "@/lib/i18n";

interface BacktestRunsTableProps {
  busy: boolean;
  deleting: boolean;
  runs: BacktestRunSummary[];
  selectedId: string | null;
  selectedRunIds: Set<string>;
  symbols: SymbolRecord[];
  onDeleteSelected: () => void;
  onSelect: (runId: string) => void;
  onToggle: (runId: string) => void;
}

export function BacktestRunsTable({
  busy,
  deleting,
  runs,
  selectedId,
  selectedRunIds,
  symbols,
  onDeleteSelected,
  onSelect,
  onToggle,
}: BacktestRunsTableProps): React.JSX.Element {
  const { intlLocale, t } = useI18n();

  return (
    <section className="panel table-panel backtest-runs">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{t("runs.eyebrow")}</span>
          <h2>{t("runs.title")}</h2>
        </div>
        <span className="count-badge">{t("runs.count", { count: runs.length })}</span>
      </div>
      {selectedRunIds.size > 0 ? (
        <div className="research-bulk-actions">
          <span>{selectedRunIds.size}</span>
          <button
            disabled={busy || deleting}
            onClick={onDeleteSelected}
            type="button"
          >
            <Trash2 size={13} />
            {deleting ? t("runs.deleting") : t("runs.delete")}
          </button>
        </div>
      ) : null}
      {runs.length === 0 ? (
        <div className="panel-empty compact">{t("runs.empty")}</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th aria-label={t("runs.select")} />
                <th>{t("runs.run")}</th>
                <th>{t("runs.market")}</th>
                <th>{t("runs.return")}</th>
                <th>{t("runs.final")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr className={run.id === selectedId ? "selected-row" : undefined} key={run.id}>
                  <td>
                    <input
                      aria-label={`${t("runs.select")} ${new Date(run.created_at).toLocaleString(intlLocale)}`}
                      checked={selectedRunIds.has(run.id)}
                      disabled={busy || deleting}
                      onChange={() => onToggle(run.id)}
                      type="checkbox"
                    />
                  </td>
                  <td>
                    <button
                      aria-label={`${t("runs.open")} ${new Date(run.created_at).toLocaleString(intlLocale)}`}
                      className="research-open-button"
                      disabled={busy || deleting}
                      onClick={() => onSelect(run.id)}
                      type="button"
                    >
                      <svg
                        aria-hidden="true"
                        className={`research-mini-chart ${Number(run.return_pct) >= 0 ? "positive" : "negative"}`}
                        viewBox="0 0 44 22"
                      >
                        <polyline
                          points={
                            Number(run.return_pct) >= 0
                              ? "1,18 10,15 18,16 27,8 35,10 43,3"
                              : "1,4 10,7 18,6 27,14 35,12 43,19"
                          }
                        />
                      </svg>
                      <span>
                        {new Date(run.created_at).toLocaleString(intlLocale)}
                        <small>v{run.strategy_version}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    {symbols.find((item) => item.id === run.symbol_id)?.name ?? "—"} / {run.timeframe}
                  </td>
                  <td className={Number(run.return_pct) >= 0 ? "positive" : "negative"}>
                    {formatPercent(run.return_pct)}
                  </td>
                  <td className="mono">{formatMoney(run.final_balance, intlLocale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
