"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n";

interface LocalizedDateTimeInputProps {
  label: string;
  onChange: (value: string) => void;
  value: string;
}

function localDateInput(date: Date): string {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function dateFrom(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function LocalizedDateTimeInput({
  label,
  onChange,
  value,
}: LocalizedDateTimeInputProps): React.JSX.Element {
  const { intlLocale, t } = useI18n();
  const selected = dateFrom(value);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  useEffect(() => {
    const nextSelected = dateFrom(value);
    setViewMonth(new Date(
      nextSelected.getFullYear(), nextSelected.getMonth(), 1,
    ));
  }, [value]);

  const days = useMemo(() => {
    const mondayOffset = (viewMonth.getDay() + 6) % 7;
    const first = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth(),
      1 - mondayOffset,
    );
    return Array.from({ length: 42 }, (_, index) => new Date(
      first.getFullYear(), first.getMonth(), first.getDate() + index,
    ));
  }, [viewMonth]);
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(intlLocale, { weekday: "short" }).format(
      new Date(2026, 0, 5 + index),
    ),
  );
  const formatted = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(selected);

  const chooseDay = (day: Date): void => {
    onChange(localDateInput(new Date(
      day.getFullYear(), day.getMonth(), day.getDate(),
      selected.getHours(), selected.getMinutes(),
    )));
  };

  return (
    <div className="localized-date-time">
      <input
        aria-label={label}
        className="localized-native-input"
        lang={intlLocale}
        onChange={(event) => onChange(event.target.value)}
        required
        type="datetime-local"
        value={value}
      />
      <button
        aria-expanded={open}
        aria-label={t("calendar.open", { label })}
        className="localized-date-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <CalendarDays aria-hidden="true" size={15} />
        <span>{formatted}</span>
      </button>
      {open ? (
        <div className="localized-calendar" role="dialog" aria-label={label}>
          <div className="localized-calendar-heading">
            <button
              aria-label={t("calendar.previous")}
              onClick={() => setViewMonth(new Date(
                viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1,
              ))}
              type="button"
            >
              <ChevronLeft size={15} />
            </button>
            <strong>
              {new Intl.DateTimeFormat(intlLocale, {
                month: "long",
                year: "numeric",
              }).format(viewMonth)}
            </strong>
            <button
              aria-label={t("calendar.next")}
              onClick={() => setViewMonth(new Date(
                viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1,
              ))}
              type="button"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="localized-calendar-grid weekdays">
            {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="localized-calendar-grid">
            {days.map((day) => {
              const selectedDay = day.toDateString() === selected.toDateString();
              const outside = day.getMonth() !== viewMonth.getMonth();
              return (
                <button
                  aria-pressed={selectedDay}
                  className={outside ? "outside" : undefined}
                  key={day.toISOString()}
                  onClick={() => chooseDay(day)}
                  type="button"
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="localized-calendar-footer">
            <input
              aria-label={t("calendar.time")}
              onChange={(event) => {
                const [hours, minutes] = event.target.value.split(":").map(Number);
                onChange(localDateInput(new Date(
                  selected.getFullYear(), selected.getMonth(), selected.getDate(),
                  hours, minutes,
                )));
              }}
              type="time"
              value={value.slice(11, 16)}
            />
            <button onClick={() => setOpen(false)} type="button">
              {t("calendar.done")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
