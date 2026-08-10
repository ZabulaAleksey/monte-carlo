import { Clock3, Radio, TriangleAlert } from "lucide-react";

import type { Mt5Status } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

function formatTime(
  value: string | null | undefined,
  locale: string,
  neverLabel: string,
): string {
  if (!value) return neverLabel;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}
export function Mt5ConnectionCard({ status }: { status: Mt5Status }): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const state = !status.configured
    ? "unconfigured"
    : status.connected
      ? "connected"
      : "stale";
  const label = !status.configured
    ? t("mt5.apiKeyRequired")
    : status.connected
      ? t("mt5.terminalConnected")
      : status.terminal
        ? t("mt5.terminalOffline")
        : t("mt5.waitingTerminal");
  const neverLabel = t("mt5.never");

  return (
    <section
      className={`mt5-connection ${state}`}
      aria-live="polite"
      role={state === "stale" ? "alert" : "status"}
    >
      <div className="mt5-status-icon">
        {state === "connected" ? <Radio size={21} /> : <TriangleAlert size={21} />}
      </div>
      <div className="mt5-status-copy">
        <span className="eyebrow">{t("mt5.bridge")}</span>
        <strong>{label}</strong>
        <small>
          {status.terminal
            ? `${status.terminal.terminal_name} · ${t("mt5.build", { value: status.terminal.terminal_build })}`
            : t("mt5.noHeartbeat")}
        </small>
      </div>
      <div className="mt5-sync-time">
        <Clock3 size={15} aria-hidden="true" />
        <div>
          <span>{t("mt5.lastSync")}</span>
          <strong>{formatTime(status.terminal?.last_sync_at, intlLocale, neverLabel)}</strong>
          <small>
            {t("mt5.heartbeat", {
              value: formatTime(status.terminal?.last_heartbeat_at, intlLocale, neverLabel),
            })}
          </small>
        </div>
      </div>
    </section>
  );
}
