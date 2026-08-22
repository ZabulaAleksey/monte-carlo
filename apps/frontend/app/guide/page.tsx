"use client";

import { CircleCheck, ExternalLink } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { useI18n } from "@/lib/i18n";

const steps = [
  ["01", "guide.stepDocker", "guide.stepDockerText", "docker compose up -d --build"],
  ["02", "guide.stepMigration", "guide.stepMigrationText", "docker compose exec backend alembic upgrade head"],
  ["03", "guide.stepMt5", "guide.stepMt5Text", "MQL5/Experts/MonteCarloBridge.mq5"],
  ["04", "guide.stepData", "guide.stepDataText", "/market-data"],
  ["05", "guide.stepTest", "guide.stepTestText", "/strategies"],
] as const;

export default function GuidePage(): React.JSX.Element {
  const { t } = useI18n();
  return (
    <>
      <PageHeader description={t("guide.description")} eyebrow={t("guide.eyebrow")} title={t("guide.title")} />
      <section className="guide-layout">
        <div className="guide-steps">
          {steps.map(([number, title, text, command]) => (
            <article className="panel guide-step" key={number}>
              <span>{number}</span><div><h2>{t(title)}</h2><p>{t(text)}</p><code>{command}</code></div>
            </article>
          ))}
        </div>
        <aside className="panel guide-aside">
          <span className="eyebrow">CHECKLIST</span>
          <h2>{t("guide.checkTitle")}</h2>
          {["guide.checkDocker", "guide.checkBackend", "guide.checkMigration", "guide.checkMt5"].map((key) => <p key={key}><CircleCheck size={15} /> {t(key as "guide.checkDocker")}</p>)}
          <Link href="/api-docs">{t("guide.openApi")} <ExternalLink size={14} /></Link>
          <a href="/offline/index.html" target="_blank">{t("guide.openOffline")} <ExternalLink size={14} /></a>
        </aside>
      </section>
      <section className="panel guide-troubleshooting">
        <span className="eyebrow">FAQ</span><h2>{t("guide.troubleTitle")}</h2>
        <h3>{t("guide.noDocker")}</h3><p>{t("guide.noDockerText")}</p>
        <h3>{t("guide.noMt5")}</h3><p>{t("guide.noMt5Text")}</p>
        <h3>{t("guide.partial")}</h3><p>{t("guide.partialText")}</p>
      </section>
    </>
  );
}
