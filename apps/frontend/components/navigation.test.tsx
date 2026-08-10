import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Navigation } from "./navigation";
import { I18nProvider } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/hooks/use-mt5-status", () => ({
  useMt5Status: vi.fn(),
}));

import { useMt5Status } from "@/hooks/use-mt5-status";

describe("Navigation", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
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

  it("switches languages with flag controls and persists the selected locale", () => {
    render(
      <I18nProvider>
        <Navigation />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: "English" })).toHaveTextContent("EN");
    expect(screen.getByRole("button", { name: "Русский" })).toHaveTextContent("🇷🇺");
    expect(screen.getByRole("button", { name: "Українська" })).toHaveTextContent("🇺🇦");
    expect(screen.getByRole("button", { name: "Беларуская" })).toHaveTextContent("🇧🇾");

    fireEvent.click(screen.getByRole("button", { name: "Русский" }));

    expect(screen.getByText("Онлайн-среда")).toBeInTheDocument();
    expect(screen.getByText("Дашборд")).toBeInTheDocument();
    expect(window.localStorage.getItem("montecarlo.locale.v1")).toBe("ru");
  });

  it("switches to Belarusian and persists the locale", () => {
    render(
      <I18nProvider>
        <Navigation />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Беларуская" }));

    expect(screen.getByText("Анлайн-асяроддзе")).toBeInTheDocument();
    expect(screen.getByText("Панэль")).toBeInTheDocument();
    expect(window.localStorage.getItem("montecarlo.locale.v1")).toBe("be");
  });
});
