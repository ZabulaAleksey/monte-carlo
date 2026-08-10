"use client";

import {
  ChartCandlestick,
  FlaskConical,
  LayoutDashboard,
  Settings,
  TableProperties,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useMt5Status } from "@/hooks/use-mt5-status";
import { supportedLocales, useI18n } from "@/lib/i18n";

const links = [
  { href: "/", label: "nav.dashboard" as const, icon: LayoutDashboard },
  { href: "/market-data", label: "nav.marketData" as const, icon: ChartCandlestick },
  { href: "/trades", label: "nav.trades" as const, icon: TableProperties },
  { href: "/strategies", label: "nav.strategies" as const, icon: FlaskConical },
  { href: "/settings", label: "nav.settings" as const, icon: Settings },
] as const;

export function Navigation(): React.JSX.Element {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const { error, status } = useMt5Status();
  const connected = status?.connected === true;
  const checking = status === null && error === null;
  const environmentState = connected ? "online" : checking ? "checking" : "offline";
  const environmentLabel = connected
    ? t("status.online")
    : checking
      ? t("status.checking")
      : t("status.demo");
  const environmentDetail = connected
    ? t("status.feedOnline")
    : error
      ? t("status.unavailable")
      : status?.configured
        ? t("status.feedOffline")
        : t("status.sampleFeed");

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">MC</span>
        <div>
          <strong>MonteCarlo</strong>
          <small>Trading intelligence</small>
        </div>
      </div>
      <nav aria-label="Main navigation">
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
      <div className="language-switcher" aria-label={t("language.label")}>
        {supportedLocales.map((item) => (
          <button
            aria-pressed={locale === item.code}
            className={locale === item.code ? "active" : undefined}
            key={item.code}
            onClick={() => setLocale(item.code)}
            type="button"
          >
            {item.label}
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
