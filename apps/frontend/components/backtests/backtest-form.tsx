"use client";

import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { useEffect, useState } from "react";

import { LocalizedDateTimeInput } from "@/components/localized-date-time-input";
import type {
  BacktestCreateRequest,
  BacktestJobRecord,
  StrategyDefinition,
  SymbolRecord,
} from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

const advisorLabelKeys = {
  short_window: "advisor.short_window",
  long_window: "advisor.long_window",
  position_size: "advisor.position_size",
  stop_loss_pct: "advisor.stop_loss_pct",
  take_profit_pct: "advisor.take_profit_pct",
} as const;

interface BacktestFormProps {
  busy: boolean;
  job: BacktestJobRecord | null;
  strategies: StrategyDefinition[];
  symbols: SymbolRecord[];
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onStop: () => Promise<void>;
  onSubmit: (payload: BacktestCreateRequest) => Promise<void>;
}

interface FormState {
  strategyName: string;
  symbolId: string;
  timeframe: string;
  startAt: string;
  endAt: string;
  initialCapital: string;
  commissionPctPerFill: string;
  swapPctPerLotPerDay: string;
  slippagePoints: string;
  parameters: Record<string, string>;
}

function localDateInput(date: Date): string {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

const PERIOD_STORAGE_KEY = "montecarlo.backtest.period.v1";

function initialPeriod(): { startAt: string; endAt: string } {
  if (typeof window !== "undefined") {
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(PERIOD_STORAGE_KEY) ?? "null",
      ) as { startAt?: unknown; endAt?: unknown } | null;
      if (
        typeof stored?.startAt === "string" &&
        typeof stored.endAt === "string" &&
        !Number.isNaN(new Date(stored.startAt).getTime()) &&
        !Number.isNaN(new Date(stored.endAt).getTime())
      ) {
        return { startAt: stored.startAt, endAt: stored.endAt };
      }
    } catch {
      // A valid in-memory default remains available when storage is restricted.
    }
  }
  const end = new Date();
  end.setMinutes(0, 0, 0);
  end.setHours(end.getHours() - 1);
  const start = new Date(end.getTime() - 48 * 60 * 60 * 1000);
  return { startAt: localDateInput(start), endAt: localDateInput(end) };
}

function normalizeLotValue(value: string, symbol: SymbolRecord | undefined): string {
  if (!symbol) return value;
  const minimum = Number(symbol.volume_min);
  const step = Number(symbol.volume_step);
  const maximum = Math.min(Number(symbol.volume_max), 99);
  const numeric = Math.min(Math.max(Number(value), minimum), maximum);
  const maximumStep = Math.max(Math.floor((maximum - minimum) / step), 0);
  const stepIndex = Math.min(
    Math.ceil((numeric - minimum - Number.EPSILON) / step),
    maximumStep,
  );
  const aligned = minimum + Math.max(stepIndex, 0) * step;
  const decimals = Math.max(
    symbol.volume_min.split(".")[1]?.replace(/0+$/, "").length ?? 0,
    symbol.volume_step.split(".")[1]?.replace(/0+$/, "").length ?? 0,
  );
  return aligned.toFixed(decimals);
}

function initialParameters(
  strategy: StrategyDefinition | undefined,
  symbol: SymbolRecord | undefined,
): Record<string, string> {
  return Object.fromEntries(
    (strategy?.parameters ?? []).map((parameter) => [
      parameter.name,
      parameter.name === "position_size"
        ? normalizeLotValue(String(parameter.default), symbol)
        : String(parameter.default),
    ]),
  );
}

export function BacktestForm({
  busy,
  job,
  strategies,
  symbols,
  onPause,
  onResume,
  onStop,
  onSubmit,
}: BacktestFormProps): React.JSX.Element {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() => {
    const period = initialPeriod();
    return {
      strategyName: strategies[0]?.name ?? "",
      symbolId: symbols[0]?.id ?? "",
      timeframe: "H1",
      startAt: period.startAt,
      endAt: period.endAt,
      initialCapital: "10000",
      commissionPctPerFill: "0",
      swapPctPerLotPerDay: "0",
      slippagePoints: "0",
      parameters: initialParameters(strategies[0], symbols[0]),
    };
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PERIOD_STORAGE_KEY,
        JSON.stringify({ startAt: form.startAt, endAt: form.endAt }),
      );
    } catch {
      // Date selection still works when persistence is unavailable.
    }
  }, [form.endAt, form.startAt]);
  const selectedStrategy = strategies.find((item) => item.name === form.strategyName);
  const selectedSymbol = symbols.find((item) => item.id === form.symbolId);
  const strategyTitle = (strategy: StrategyDefinition): string =>
    strategy.name === "moving_average_cross" ? t("strategy.maTitle") : strategy.title;
  const advisorLabel = (name: string, fallback: string): string => {
    const key = advisorLabelKeys[name as keyof typeof advisorLabelKeys];
    return key ? t(key) : fallback;
  };

  const update = (field: keyof Omit<FormState, "parameters">, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectStrategy = (strategyName: string): void => {
    const strategy = strategies.find((item) => item.name === strategyName);
    setForm((current) => ({
      ...current,
      strategyName,
      parameters: initialParameters(strategy, selectedSymbol),
    }));
  };

  const selectSymbol = (symbolId: string): void => {
    const symbol = symbols.find((item) => item.id === symbolId);
    setForm((current) => ({
      ...current,
      symbolId,
      parameters: {
        ...current.parameters,
        position_size: normalizeLotValue(
          current.parameters.position_size ?? "0.01",
          symbol,
        ),
      },
    }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parameters = Object.fromEntries(
      (selectedStrategy?.parameters ?? []).map((parameter) => {
        const value = form.parameters[parameter.name] ?? String(parameter.default);
        return [
          parameter.name,
          parameter.value_type === "integer" ? Number(value) : value,
        ];
      }),
    );
    void onSubmit({
      strategy_name: form.strategyName,
      symbol_id: form.symbolId,
      timeframe: form.timeframe,
      start_at: new Date(form.startAt).toISOString(),
      end_at: new Date(form.endAt).toISOString(),
      initial_capital: form.initialCapital,
      commission_pct_per_fill: form.commissionPctPerFill,
      swap_pct_per_lot_per_day: form.swapPctPerLotPerDay,
      slippage_points: form.slippagePoints,
      parameters,
    });
  };

  const jobMessage = job
    ? {
        queued: t("job.queued"),
        loading_data: t("job.loading_data"),
        simulating: t("job.simulating"),
        paused: t("job.paused"),
        completed: t("job.completed"),
        stopped: t("job.stopped"),
        failed: t("job.failed"),
      }[job.state]
    : "";

  return (
    <form className="backtest-form panel" onSubmit={submit}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{t("form.eyebrow")}</span>
          <h2>{t("form.title")}</h2>
        </div>
        <span className="tag">{t("form.noFuture")}</span>
      </div>

      <fieldset className="backtest-fieldset" disabled={busy}>
        <div className="form-fields">
          <label className="form-field form-field-wide">
            <span>{t("form.strategy")}</span>
            <select
              aria-label={t("form.strategy")}
              onChange={(event) => selectStrategy(event.target.value)}
              value={form.strategyName}
            >
              {strategies.map((strategy) => (
                <option key={strategy.name} value={strategy.name}>
                  {strategyTitle(strategy)} / v{strategy.version}
                </option>
              ))}
            </select>
            <small>
              {selectedStrategy?.name === "moving_average_cross"
                ? t("strategy.maDescription")
                : selectedStrategy?.description}
            </small>
          </label>
          <label className="form-field">
            <span>{t("form.instrument")}</span>
            <select
              aria-label={t("form.instrument")}
              onChange={(event) => selectSymbol(event.target.value)}
              required
              value={form.symbolId}
            >
              {symbols.map((symbol) => (
                <option key={symbol.id} value={symbol.id}>{symbol.name}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t("form.timeframe")}</span>
            <select
              aria-label={t("form.timeframe")}
              onChange={(event) => update("timeframe", event.target.value)}
              value={form.timeframe}
            >
              {["M1", "M5", "M15", "H1", "H4", "D1"].map((timeframe) => (
                <option key={timeframe}>{timeframe}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t("form.from")}</span>
            <LocalizedDateTimeInput
              label={t("form.from")}
              onChange={(value) => update("startAt", value)}
              value={form.startAt}
            />
          </label>
          <label className="form-field">
            <span>{t("form.to")}</span>
            <LocalizedDateTimeInput
              label={t("form.to")}
              onChange={(value) => update("endAt", value)}
              value={form.endAt}
            />
          </label>
          <label className="form-field form-field-wide">
            <span>{t("form.capital")}</span>
            <input
              aria-label={t("form.capital")}
              min="100"
              onChange={(event) => update("initialCapital", event.target.value)}
              required
              step="100"
              type="number"
              value={form.initialCapital}
            />
          </label>
        </div>

        <div className="form-section">
          <strong>{t("form.advisor")}</strong>
          <small>{t("form.advisorHint")}</small>
          <div className="form-fields">
            {selectedStrategy?.parameters.map((parameter) => {
              const lotParameter = parameter.name === "position_size";
              const minimum = lotParameter
                ? selectedSymbol?.volume_min
                : parameter.minimum ?? undefined;
              const maximum = lotParameter
                ? String(Math.min(Number(selectedSymbol?.volume_max ?? 99), 99))
                : parameter.maximum ?? undefined;
              const step = lotParameter
                ? selectedSymbol?.volume_step ?? "0.01"
                : parameter.value_type === "integer" ? "1" : "any";
              return (
              <label className="form-field" key={parameter.name}>
                <span>{advisorLabel(parameter.name, parameter.label)}</span>
                <input
                  aria-label={advisorLabel(parameter.name, parameter.label)}
                  max={maximum}
                  min={minimum}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      parameters: {
                        ...current.parameters,
                        [parameter.name]: event.target.value,
                      },
                    }))
                  }
                  required
                  step={step}
                  type="number"
                  value={form.parameters[parameter.name] ?? ""}
                />
                {lotParameter && selectedSymbol ? (
                  <small>
                    {t("form.lotRange", {
                      min: selectedSymbol.volume_min,
                      step: selectedSymbol.volume_step,
                      max: maximum ?? 99,
                    })}
                  </small>
                ) : null}
              </label>
              );
            })}
          </div>
        </div>

        <div className="form-section stress-section">
          <strong>{t("form.stress")}</strong>
          <small>{t("form.stressHint")}</small>
          <div className="form-fields">
            <label className="form-field">
              <span>{t("form.commission")}</span>
              <input
                aria-label={t("form.commission")}
                min="0"
                max="100"
                onChange={(event) => update("commissionPctPerFill", event.target.value)}
                step="any"
                type="number"
                value={form.commissionPctPerFill}
              />
            </label>
            <label className="form-field">
              <span>{t("form.swap")}</span>
              <input
                aria-label={t("form.swap")}
                max="100"
                min="-100"
                onChange={(event) => update("swapPctPerLotPerDay", event.target.value)}
                step="any"
                type="number"
                value={form.swapPctPerLotPerDay}
              />
            </label>
            <label className="form-field">
              <span>{t("form.slippagePoints")}</span>
              <input
                aria-label={t("form.slippagePoints")}
                min="0"
                onChange={(event) => update("slippagePoints", event.target.value)}
                step="any"
                type="number"
                value={form.slippagePoints}
              />
            </label>
          </div>
        </div>
      </fieldset>

      <button className="primary-button" disabled={busy || !form.symbolId} type="submit">
        <Play aria-hidden="true" size={16} />
        {busy ? jobMessage || t("job.loading_data") : t("form.run")}
      </button>

      {busy && job ? (
        <div className="backtest-job" aria-live="polite">
          <div className="job-copy">
            <strong>{jobMessage}</strong>
            <span>
              {job.total_candles
                ? `${job.processed_candles} / ${job.total_candles}`
                : "—"}
            </span>
          </div>
          <div className="job-progress" role="progressbar" aria-valuenow={Number(job.progress_pct)}>
            <span style={{ width: `${job.progress_pct}%` }} />
          </div>
          <div className="job-actions">
            {job.state === "paused" ? (
              <button onClick={() => void onResume()} type="button">
                <RotateCcw size={14} /> {t("job.resume")}
              </button>
            ) : (
              <button onClick={() => void onPause()} type="button">
                <Pause size={14} /> {t("job.pause")}
              </button>
            )}
            <button className="danger" onClick={() => void onStop()} type="button">
              <Square size={13} /> {t("job.stop")}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
