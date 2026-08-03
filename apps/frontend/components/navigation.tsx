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

import { usePollingQuery } from "@/hooks/use-polling-query";
import { deriveDataEnvironment } from "@/lib/data-environment";
import { loadEnvironmentData } from "@/lib/page-data";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/market-data", label: "Market Data", icon: ChartCandlestick },
  { href: "/trades", label: "Trades", icon: TableProperties },
  { href: "/strategies", label: "Strategies", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Navigation(): React.JSX.Element {
  const pathname = usePathname();
  const { data, error } = usePollingQuery(loadEnvironmentData);
  const environment = data ? deriveDataEnvironment(data.accounts, data.mt5) : null;
  const environmentClass = error && !data
    ? "unavailable"
    : environment?.online
      ? "online"
      : environment?.kind ?? "loading";
  const environmentTitle = error && !data
    ? "Environment unavailable"
    : environment?.title ?? "Checking environment";
  const environmentDescription = error && !data
    ? error
    : environment?.description ?? "Loading data source";

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
              {label}
            </Link>
          );
        })}
      </nav>
      <div className={`sidebar-status ${environmentClass}`}>
        <span className="status-dot" />
        <div>
          <strong>{environmentTitle}</strong>
          <small>{environmentDescription}</small>
        </div>
      </div>
    </aside>
  );
}
