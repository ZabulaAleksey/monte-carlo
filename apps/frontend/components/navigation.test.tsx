import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Navigation } from "./navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/hooks/use-mt5-status", () => ({
  useMt5Status: vi.fn(),
}));

import { useMt5Status } from "@/hooks/use-mt5-status";

describe("Navigation", () => {
  beforeEach(() => {
    vi.mocked(useMt5Status).mockReturnValue({
      error: null,
      status: {
        configured: true,
        connected: true,
        stale: false,
        stale_after_seconds: 90,
        terminal: null,
      },
    });
  });

  it("shows the online environment when MT5 is connected", () => {
    render(<Navigation />);

    expect(screen.getByText("Online environment")).toBeInTheDocument();
    expect(screen.getByText("MT5 market feed online")).toBeInTheDocument();
    expect(screen.queryByText("Demo environment")).not.toBeInTheDocument();
  });

  it("shows the demo fallback when MT5 is offline", () => {
    vi.mocked(useMt5Status).mockReturnValue({
      error: null,
      status: {
        configured: true,
        connected: false,
        stale: true,
        stale_after_seconds: 90,
        terminal: null,
      },
    });

    render(<Navigation />);

    expect(screen.getByText("Demo environment")).toBeInTheDocument();
    expect(screen.getByText(/MT5 feed offline/)).toBeInTheDocument();
  });
});
