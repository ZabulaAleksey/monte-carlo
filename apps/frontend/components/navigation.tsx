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

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/market-data", label: "Market Data", icon: ChartCandlestick },
  { href: "/trades", label: "Trades", icon: TableProperties },
  { href: "/strategies", label: "Strategies", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Navigation(): React.JSX.Element {
  const pathname = usePathname();
  const { error, status } = useMt5Status();
  const connected = status?.connected === true;
  const checking = status === null && error === null;
  const environmentState = connected ? "online" : checking ? "checking" : "offline";
  const environmentLabel = connected
    ? "Online environment"
    : checking
      ? "Checking environment"
      : "Demo environment";
  const environmentDetail = connected
    ? "MT5 market feed online"
    : error
      ? "Connection status unavailable"
      : status?.configured
        ? "MT5 feed offline · sample data"
        : "Sample market feed";

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
