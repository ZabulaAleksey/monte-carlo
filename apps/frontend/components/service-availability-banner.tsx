"use client";

import { AlertTriangle, BookOpen } from "lucide-react";
import Link from "next/link";

import { useMt5Status } from "@/hooks/use-mt5-status";
import { useI18n } from "@/lib/i18n";

export function ServiceAvailabilityBanner(): React.JSX.Element | null {
  const { error, status } = useMt5Status();
  const { t } = useI18n();
  if (!error && (status === null || status.connected)) return null;

  return (
    <aside className="service-availability-banner" role="status">
      <AlertTriangle aria-hidden="true" size={18} />
      <div>
        <strong>{error ? t("offline.backendTitle") : t("offline.mt5Title")}</strong>
        <span>{error ? t("offline.backendText") : t("offline.mt5Text")}</span>
      </div>
      <Link href="/guide"><BookOpen size={15} /> {t("offline.openGuide")}</Link>
    </aside>
  );
}
