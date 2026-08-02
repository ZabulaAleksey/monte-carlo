import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    getAccounts: vi.fn(),
    getCandles: vi.fn(),
    getSymbols: vi.fn(),
    getTrades: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api/client";

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.getAccounts).mockResolvedValue([]);
    vi.mocked(apiClient.getCandles).mockResolvedValue([]);
    vi.mocked(apiClient.getSymbols).mockResolvedValue([]);
    vi.mocked(apiClient.getTrades).mockResolvedValue([]);
  });

  it("loads the dashboard shell and data", async () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Trading performance, in focus." })).toBeInTheDocument();
    expect(await screen.findByText("Portfolio balance")).toBeInTheDocument();
  });
});
