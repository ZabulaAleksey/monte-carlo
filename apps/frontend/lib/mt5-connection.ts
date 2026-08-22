import type { Mt5Status } from "@/lib/api/types";

export type Mt5ConnectionState =
  | "checking"
  | "backend-unavailable"
  | "unconfigured"
  | "connected"
  | "terminal-offline"
  | "waiting-terminal";

export interface Mt5ConnectionViewModel {
  configured: boolean;
  online: boolean;
  state: Mt5ConnectionState;
  status: Mt5Status | null;
}

export function buildMt5ConnectionViewModel(
  status: Mt5Status | null,
  error: string | null = null,
): Mt5ConnectionViewModel {
  if (error) return { configured: false, online: false, state: "backend-unavailable", status };
  if (!status) return { configured: false, online: false, state: "checking", status };
  if (!status.configured) return { configured: false, online: false, state: "unconfigured", status };
  if (status.connected) return { configured: true, online: true, state: "connected", status };
  return {
    configured: true,
    online: false,
    state: status.terminal ? "terminal-offline" : "waiting-terminal",
    status,
  };
}
