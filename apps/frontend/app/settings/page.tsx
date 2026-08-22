"use client";

import { Database, Radio, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { API_URL } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage(): React.JSX.Element {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        eyebrow={t("settings.pageEyebrow")}
        title={t("settings.pageTitle")}
        description={t("settings.pageDescription")}
      />
      <section className="settings-grid">
        <article className="panel setting-card">
          <Radio size={20} />
          <div>
            <span>{t("settings.backendEndpoint")}</span>
            <strong className="mono">{API_URL}</strong>
            <small>{t("settings.backendConfigured")}</small>
          </div>
        </article>
        <article className="panel setting-card">
          <Database size={20} />
          <div>
            <span>{t("settings.dataMode")}</span>
            <strong>{t("settings.postgresDemo")}</strong>
            <small>{t("settings.durableStorage")}</small>
          </div>
        </article>
        <article className="panel setting-card">
          <ShieldCheck size={20} />
          <div>
            <span>{t("settings.credentials")}</span>
            <strong>{t("settings.environmentOnly")}</strong>
            <small>{t("settings.noSecrets")}</small>
          </div>
        </article>
      </section>
    </>
  );
}
