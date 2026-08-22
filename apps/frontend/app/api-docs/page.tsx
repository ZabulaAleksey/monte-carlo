"use client";

import { BookDown, Braces, ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { API_URL } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n";

const endpoints = [
  ["POST", "/api/v1/tester/backtests", "api.endpointRun"],
  ["GET", "/api/v1/tester/backtests", "api.endpointRuns"],
  ["GET", "/api/v1/tester/backtests/{run_id}", "api.endpointResult"],
  ["GET", "/api/v1/tester/backtests/{run_id}/trades", "api.endpointTrades"],
  ["GET", "/api/v1/tester/backtests/history/coverage", "api.endpointCoverage"],
] as const;

export default function ApiDocsPage(): React.JSX.Element {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        badge={t("api.badge")}
        description={t("api.description")}
        eyebrow={t("api.eyebrow")}
        title={t("api.title")}
      />
      <section className="docs-action-grid">
        <a className="panel docs-action" href={API_URL + "/docs"} rel="noreferrer" target="_blank">
          <ExternalLink size={20} />
          <div><strong>{t("api.swagger")}</strong><span>{t("api.swaggerHint")}</span></div>
        </a>
        <a className="panel docs-action" href={API_URL + "/openapi.json"} rel="noreferrer" target="_blank">
          <Braces size={20} />
          <div><strong>OpenAPI JSON</strong><span>{t("api.schemaHint")}</span></div>
        </a>
        <a className="panel docs-action" download href="/montecarlo-tester-api.md">
          <BookDown size={20} />
          <div><strong>{t("api.download")}</strong><span>{t("api.downloadHint")}</span></div>
        </a>
      </section>
      <section className="panel docs-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">REST</span><h2>{t("api.endpoints")}</h2></div>
          <span className="tag">/api/v1/tester</span>
        </div>
        <div className="endpoint-list">
          {endpoints.map(([method, path, label]) => (
            <article key={method + path}>
              <span className={"http-method " + method.toLowerCase()}>{method}</span>
              <code>{path}</code>
              <p>{t(label)}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="panel docs-panel">
        <div className="panel-heading"><div><span className="eyebrow">curl</span><h2>{t("api.example")}</h2></div></div>
        <pre className="docs-code"><code>{`curl ${API_URL}/api/v1/tester/backtests`}</code></pre>
        <p className="docs-note">{t("api.partialHint")}</p>
      </section>
    </>
  );
}
