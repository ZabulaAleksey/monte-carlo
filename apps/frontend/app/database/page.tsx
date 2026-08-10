"use client";

import { Database, HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { apiClient } from "@/lib/api/client";
import type { DatabaseOverviewRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

function formatBytes(value: number | null, locale: string): string {
  if (value === null) return "—";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 1_048_576) + " MB";
}

export default function DatabasePage(): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const [overview, setOverview] = useState<DatabaseOverviewRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await apiClient.getDatabaseOverview());
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : t("error.unknown"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <>
      <PageHeader
        badge={t("database.readOnly")}
        description={t("database.description")}
        eyebrow={t("database.eyebrow")}
        title={t("database.title")}
      />
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState /> : null}
      {overview && !loading ? (
        <>
          <section className="database-summary">
            <article className="panel database-summary-card"><Database size={20} /><div><span>{t("database.name")}</span><strong>{overview.database_name}</strong><small>{overview.engine} / {overview.server_version}</small></div></article>
            <article className="panel database-summary-card"><HardDrive size={20} /><div><span>{t("database.size")}</span><strong>{formatBytes(overview.database_size_bytes, intlLocale)}</strong><small>{t("database.revision")}: {overview.schema_revision ?? "—"}</small></div></article>
            <article className="panel database-summary-card"><ShieldCheck size={20} /><div><span>{t("database.access")}</span><strong>{t("database.readOnly")}</strong><small>{t("database.safeHint")}</small></div></article>
          </section>
          <section className="panel database-panel">
            <div className="panel-heading"><div><span className="eyebrow">PostgreSQL</span><h2>{t("database.tables")}</h2></div><button className="secondary-button" onClick={() => void refresh()} type="button"><RefreshCw size={14} /> {t("database.refresh")}</button></div>
            <div className="database-table-grid">
              {overview.tables.map((table) => <article key={table.name}><code>{table.name}</code><strong>{new Intl.NumberFormat(intlLocale).format(table.row_count)}</strong></article>)}
            </div>
          </section>
          <section className="panel database-panel">
            <div className="panel-heading"><div><span className="eyebrow">CACHE</span><h2>{t("database.datasets")}</h2></div></div>
            <div className="table-scroll"><table><thead><tr><th>{t("common.symbol")}</th><th>{t("common.timeframe")}</th><th>{t("common.source")}</th><th>{t("database.candles")}</th><th>{t("database.range")}</th></tr></thead><tbody>{overview.candle_datasets.map((dataset) => <tr key={dataset.symbol_id + dataset.timeframe + dataset.source}><td>{dataset.symbol}</td><td>{dataset.timeframe}</td><td>{dataset.source}</td><td>{new Intl.NumberFormat(intlLocale).format(dataset.candle_count)}</td><td>{new Date(dataset.first_at).toLocaleString(intlLocale)} — {new Date(dataset.last_at).toLocaleString(intlLocale)}</td></tr>)}</tbody></table></div>
            {overview.candle_datasets.length === 0 ? <div className="table-empty">{t("database.empty")}</div> : null}
          </section>
        </>
      ) : null}
    </>
  );
}
