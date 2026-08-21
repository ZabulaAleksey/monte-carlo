import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocalizedDateTimeInput } from "@/components/localized-date-time-input";
import { I18nProvider } from "@/lib/i18n";

describe("LocalizedDateTimeInput", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("uses the stored site locale for calendar chrome and month names", async () => {
    window.localStorage.setItem("montecarlo.locale.v1", "ru");
    render(
      <I18nProvider>
        <LocalizedDateTimeInput
          label="От"
          onChange={vi.fn()}
          value="2024-02-03T04:00"
        />
      </I18nProvider>,
    );

    fireEvent.click(await screen.findByRole("button", {
      name: "Открыть календарь «От»",
    }));

    expect(screen.getByRole("button", { name: "Предыдущий месяц" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Следующий месяц" })).toBeInTheDocument();
    expect(screen.getByText(/феврал/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Время")).toHaveValue("04:00");
  });

  it("lets the user select the year explicitly without changing month or time", async () => {
    const onChange = vi.fn();
    render(
      <LocalizedDateTimeInput
        label="From"
        onChange={onChange}
        value="2025-02-03T04:00"
      />,
    );

    fireEvent.click(screen.getByRole("button", {
      name: "Open From calendar",
    }));
    fireEvent.change(screen.getByLabelText("Year"), {
      target: { value: "2023" },
    });
    const currentMonthDay = screen.getAllByRole("button", { name: "3" })
      .find((button) => !button.classList.contains("outside"));
    expect(currentMonthDay).toBeDefined();
    fireEvent.click(currentMonthDay!);

    expect(onChange).toHaveBeenCalledWith("2023-02-03T04:00");
  });
});
