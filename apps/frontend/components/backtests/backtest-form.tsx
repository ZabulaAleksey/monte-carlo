"use client";

import { Play } from "lucide-react";
import { useState } from "react";

import type {
  BacktestCreateRequest,
  SlippageMode,
  StrategyDefinition,
  SymbolRecord,
} from "@/lib/api/types";

interface BacktestFormProps {
  busy: boolean;
  strategies: StrategyDefinition[];
  symbols: SymbolRecord[];
  onSubmit: (payload: BacktestCreateRequest) => Promise<void>;
}

interface FormState {
  strategyName: string;
  symbolId: string;
  timeframe: string;
  startAt: string;
  endAt: string;
  initialCapital: string;
  positionSize: string;
  stopLossPct: string;
  takeProfitPct: string;
  commissionPerFill: string;
  swapPerDay: string;
  slippageMode: SlippageMode;
  slippageValue: string;
  parameters: Record<string, string>;
}

function localDateInput(date: Date): string {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function initialParameters(strategy: StrategyDefinition | undefined): Record<string, string> {
  return Object.fromEntries(
    (strategy?.parameters ?? []).map((parameter) => [
      parameter.name,
      String(parameter.default),
    ]),
  );
}

export function BacktestForm({
  busy,
  strategies,
  symbols,
  onSubmit,
}: BacktestFormProps): React.JSX.Element {
  const [form, setForm] = useState<FormState>(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 48 * 60 * 60 * 1000);
    return {
      strategyName: strategies[0]?.name ?? "",
      symbolId: symbols[0]?.id ?? "",
      timeframe: "H1",
      startAt: localDateInput(start),
      endAt: localDateInput(end),
      initialCapital: "10000",
      positionSize: "10000",
      stopLossPct: "1",
      takeProfitPct: "2",
      commissionPerFill: "0",
      swapPerDay: "0",
      slippageMode: "fixed",
      slippageValue: "0",
      parameters: initialParameters(strategies[0]),
    };
  });
  const selectedStrategy = strategies.find((item) => item.name === form.strategyName);

  const update = (field: keyof Omit<FormState, "parameters">, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectStrategy = (strategyName: string): void => {
    const strategy = strategies.find((item) => item.name === strategyName);
    setForm((current) => ({
      ...current,
      strategyName,
      parameters: initialParameters(strategy),
    }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void onSubmit({
      strategy_name: form.strategyName,
      symbol_id: form.symbolId,
      timeframe: form.timeframe,
      start_at: new Date(form.startAt).toISOString(),
      end_at: new Date(form.endAt).toISOString(),
      initial_capital: form.initialCapital,
      position_size: form.positionSize,
      stop_loss_pct: form.stopLossPct || null,
      take_profit_pct: form.takeProfitPct || null,
      commission_per_fill: form.commissionPerFill,
      swap_per_day: form.swapPerDay,
      slippage_mode: form.slippageMode,
      slippage_value: form.slippageValue,
      parameters: Object.fromEntries(
        Object.entries(form.parameters).map(([key, value]) => [key, Number(value)]),
      ),
    });
  };

  return (
    <form className="backtest-form panel" onSubmit={submit}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Test setup</span>
          <h2>Run configuration</h2>
        </div>
        <span className="tag">No future data</span>
      </div>

      <div className="form-fields">
        <label className="form-field form-field-wide">
          <span>Strategy</span>
          <select
            aria-label="Strategy"
            onChange={(event) => selectStrategy(event.target.value)}
            value={form.strategyName}
          >
            {strategies.map((strategy) => (
              <option key={strategy.name} value={strategy.name}>
                {strategy.title} / v{strategy.version}
              </option>
            ))}
          </select>
          <small>{selectedStrategy?.description}</small>
        </label>
        <label className="form-field">
          <span>Instrument</span>
          <select
            aria-label="Instrument"
            onChange={(event) => update("symbolId", event.target.value)}
            required
            value={form.symbolId}
          >
            {symbols.map((symbol) => (
              <option key={symbol.id} value={symbol.id}>
                {symbol.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Timeframe</span>
          <select
            aria-label="Timeframe"
            onChange={(event) => update("timeframe", event.target.value)}
            value={form.timeframe}
          >
            {["M1", "M5", "M15", "H1", "H4", "D1"].map((timeframe) => (
              <option key={timeframe}>{timeframe}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>From</span>
          <input
            aria-label="From"
            onChange={(event) => update("startAt", event.target.value)}
            required
            type="datetime-local"
            value={form.startAt}
          />
        </label>
        <label className="form-field">
          <span>To</span>
          <input
            aria-label="To"
            onChange={(event) => update("endAt", event.target.value)}
            required
            type="datetime-local"
            value={form.endAt}
          />
        </label>
        <label className="form-field">
          <span>Starting capital</span>
          <input
            aria-label="Starting capital"
            min="0.01"
            onChange={(event) => update("initialCapital", event.target.value)}
            required
            step="0.01"
            type="number"
            value={form.initialCapital}
          />
        </label>
        <label className="form-field">
          <span>Position size / units</span>
          <input
            aria-label="Position size"
            min="0.00000001"
            onChange={(event) => update("positionSize", event.target.value)}
            required
            step="any"
            type="number"
            value={form.positionSize}
          />
        </label>
        <label className="form-field">
          <span>Stop loss / %</span>
          <input
            aria-label="Stop loss"
            min="0.0001"
            onChange={(event) => update("stopLossPct", event.target.value)}
            placeholder="Disabled"
            step="any"
            type="number"
            value={form.stopLossPct}
          />
        </label>
        <label className="form-field">
          <span>Take profit / %</span>
          <input
            aria-label="Take profit"
            min="0.0001"
            onChange={(event) => update("takeProfitPct", event.target.value)}
            placeholder="Disabled"
            step="any"
            type="number"
            value={form.takeProfitPct}
          />
        </label>
        <label className="form-field">
          <span>Commission / fill</span>
          <input
            aria-label="Commission per fill"
            min="0"
            onChange={(event) => update("commissionPerFill", event.target.value)}
            step="any"
            type="number"
            value={form.commissionPerFill}
          />
        </label>
        <label className="form-field">
          <span>Swap / position / day</span>
          <input
            aria-label="Swap per day"
            onChange={(event) => update("swapPerDay", event.target.value)}
            step="any"
            type="number"
            value={form.swapPerDay}
          />
        </label>
        <label className="form-field">
          <span>Slippage model</span>
          <select
            aria-label="Slippage model"
            onChange={(event) => update("slippageMode", event.target.value)}
            value={form.slippageMode}
          >
            <option value="fixed">Fixed price</option>
            <option value="relative">Relative / bps</option>
          </select>
        </label>
        <label className="form-field">
          <span>{form.slippageMode === "fixed" ? "Slippage / price" : "Slippage / bps"}</span>
          <input
            aria-label="Slippage value"
            min="0"
            onChange={(event) => update("slippageValue", event.target.value)}
            step="any"
            type="number"
            value={form.slippageValue}
          />
        </label>
        {selectedStrategy?.parameters.map((parameter) => (
          <label className="form-field" key={parameter.name}>
            <span>{parameter.label}</span>
            <input
              aria-label={parameter.label}
              max={parameter.maximum ?? undefined}
              min={parameter.minimum ?? undefined}
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
              step="1"
              type="number"
              value={form.parameters[parameter.name] ?? ""}
            />
          </label>
        ))}
      </div>
      <button className="primary-button" disabled={busy || !form.symbolId} type="submit">
        <Play aria-hidden="true" size={16} />
        {busy ? "Running sequential simulation..." : "Run backtest"}
      </button>
    </form>
  );
}
