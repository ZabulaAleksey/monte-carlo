import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { I18nProvider, useI18n } from "./i18n";

function LocaleProbe(): React.JSX.Element {
  const { intlLocale, locale, t } = useI18n();
  return <span>{locale}|{intlLocale}|{t("form.title")}</span>;
}

describe("I18nProvider", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.lang = "en";
    delete document.documentElement.dataset.locale;
  });

  it("does not render English children before local storage is resolved", () => {
    const markup = renderToString(
      <I18nProvider>
        <span>English flash</span>
      </I18nProvider>,
    );

    expect(markup).toContain("locale-bootstrap");
    expect(markup).not.toContain("English flash");
  });

  it("uses the stored locale for the first meaningful render", async () => {
    window.localStorage.setItem("montecarlo.locale.v1", "ru");

    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );

    expect(
      await screen.findByText("ru|ru-RU|Конфигурация запуска"),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ru-RU");
    expect(document.documentElement.dataset.locale).toBe("ru");
  });
});
