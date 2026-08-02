import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Mt5ConnectionCard } from "./mt5-connection-card";

describe("Mt5ConnectionCard", () => {
  it("warns when the terminal heartbeat is stale", () => {
    render(
      <Mt5ConnectionCard
        status={{
          configured: true,
          connected: false,
          stale: true,
          stale_after_seconds: 90,
          terminal: {
            terminal_id: "terminal-01",
            terminal_name: "MetaTrader 5",
            terminal_build: 5000,
            last_heartbeat_at: "2026-08-02T10:00:00Z",
            terminal_time: "2026-08-02T10:00:00Z",
            last_sync_at: "2026-08-02T09:59:00Z",
          },
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Terminal is offline");
    expect(screen.getByText("Last synchronization")).toBeInTheDocument();
  });
});
