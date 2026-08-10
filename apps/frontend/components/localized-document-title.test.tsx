import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n";

import { LocalizedDocumentTitle } from "./localized-document-title";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
}));

describe("LocalizedDocumentTitle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.title = "MonteCarlo Trading Intelligence";
  });

  it("keeps the browser title synchronized with the stored locale", async () => {
    window.localStorage.setItem("montecarlo.locale.v1", "be");
    render(
      <I18nProvider>
        <LocalizedDocumentTitle />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(document.title).toBe("MonteCarlo — Гандлёвая аналітыка");
    });

    document.title = "MonteCarlo Trading Intelligence";
    await waitFor(() => {
      expect(document.title).toBe("MonteCarlo — Гандлёвая аналітыка");
    });
  });
});
