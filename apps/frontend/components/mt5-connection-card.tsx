import { Clock3, Radio, TriangleAlert } from "lucide-react";

import type { Mt5Status } from "@/lib/api/types";

function formatTime(value: string | null | undefined): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}
export function Mt5ConnectionCard({ status }: { status: Mt5Status }): React.JSX.Element {
  const state = !status.configured
    ? "unconfigured"
    : status.connected
      ? "connected"
      : "stale";
  const label = !status.configured
    ? "API key required"
    : status.connected
      ? "Terminal connected"
      : status.terminal
        ? "Terminal is offline"
        : "Waiting for terminal";

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
        <span className="eyebrow">MetaTrader 5 bridge</span>
        <strong>{label}</strong>
        <small>
          {status.terminal
            ? `${status.terminal.terminal_name} · build ${status.terminal.terminal_build}`
            : "No heartbeat has been received yet"}
        </small>
      </div>
      <div className="mt5-sync-time">
        <Clock3 size={15} aria-hidden="true" />
        <div>
          <span>Last synchronization</span>
          <strong>{formatTime(status.terminal?.last_sync_at)}</strong>
          <small>Heartbeat: {formatTime(status.terminal?.last_heartbeat_at)}</small>
        </div>
      </div>
    </section>
  );
}
