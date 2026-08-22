"use client";

import {
  BookOpen,
  ChartCandlestick,
  Code2,
  Database,
  FlaskConical,
  LayoutDashboard,
  Settings,
  TableProperties,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LanguageFlag } from "@/components/language-flag";
import { useMt5Status } from "@/hooks/use-mt5-status";
import { supportedLocales, useI18n } from "@/lib/i18n";
import { buildMt5ConnectionViewModel } from "@/lib/mt5-connection";

const links = [
  { href: "/", label: "nav.dashboard" as const, icon: LayoutDashboard },
  { href: "/market-data", label: "nav.marketData" as const, icon: ChartCandlestick },
  { href: "/trades", label: "nav.trades" as const, icon: TableProperties },
  { href: "/strategies", label: "nav.strategies" as const, icon: FlaskConical },
  { href: "/api-docs", label: "nav.api" as const, icon: Code2 },
  { href: "/database", label: "nav.database" as const, icon: Database },
  { href: "/guide", label: "nav.guide" as const, icon: BookOpen },
  { href: "/settings", label: "nav.settings" as const, icon: Settings },
] as const;

export function Navigation(): React.JSX.Element {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const { error, status } = useMt5Status();
  const connection = buildMt5ConnectionViewModel(status, error);
  const environmentState = connection.online ? "online" : connection.state === "checking" ? "checking" : "offline";
  const environmentLabel = connection.online
    ? t("status.online")
    : connection.state === "checking"
      ? t("status.checking")
      : t("status.demo");
  const environmentDetail = connection.online
    ? t("status.feedOnline")
    : connection.state === "backend-unavailable"
      ? t("status.unavailable")
      : connection.configured
        ? t("status.feedOffline")
        : t("status.sampleFeed");

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">MC</span>
        <div>
          <strong>MonteCarlo</strong>
          <small>{t("brand.tagline")}</small>
        </div>
      </div>
      <nav aria-label={t("navigation.main")}>
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href);
          return (
            <Link className={active ? "nav-link active" : "nav-link"} href={href} key={href}>
              <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              {t(label)}
            </Link>
          );
        })}
      </nav>
      <div className="language-switcher" aria-label={t("language.label")} role="group">
        {supportedLocales.map((item) => (
          <button
            aria-label={item.name}
            aria-pressed={locale === item.code}
            className={locale === item.code ? "active" : undefined}
            key={item.code}
            onClick={() => setLocale(item.code)}
            title={item.name}
            type="button"
          >
            <LanguageFlag locale={item.code} />
          </button>
        ))}
      </div>
      <div
        aria-live="polite"
        className={`sidebar-status ${environmentState}`}
        role="status"
      >
        <span className="status-dot" />
        <div>
          <strong>{environmentLabel}</strong>
          <small>{environmentDetail}</small>
        </div>
      </div>
    </aside>
  );
}
