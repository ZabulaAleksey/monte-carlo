import { describe, expect, it } from "vitest";

import type {
  AccountRecord,
  CandleRecord,
  QuoteRecord,
  SymbolRecord,
  TradeRecord,
} from "./api/types";
import {
  buildMarketSeries,
  calculatePortfolioMetrics,
  getDashboardSource,
  mergeLiveQuotes,
  selectEnvironmentAccount,
  selectPortfolioAccount,
  selectSourceCandles,
} from "./dashboard";

const demoAccount: AccountRecord = {
  id: "demo",
  external_id: "DEMO-001",
  name: "Demo",
  currency: "USD",
  balance: "25000",
  created_at: "2026-08-02T10:00:00Z",
};

const mt5Account: AccountRecord = {
  id: "mt5",
  external_id: "10011992327",
  name: "MT5",
  currency: "USD",
  balance: "10000",
  created_at: "2026-08-02T09:00:00Z",
};

describe("dashboard data selection", () => {
  it("selects a non-demo account even when demo data is newer", () => {
    const selected = selectPortfolioAccount([demoAccount, mt5Account]);

    expect(selected).toEqual(mt5Account);
    expect(getDashboardSource(selected)).toBe("mt5");
  });

  it("selects the account reported by the active terminal", () => {
    const otherAccount = { ...mt5Account, id: "other", external_id: "200002" };

    expect(
      selectPortfolioAccount([otherAccount, mt5Account], mt5Account.external_id),
    ).toEqual(mt5Account);
  });

  it("falls back to demo data when no MT5 account exists", () => {
    const selected = selectPortfolioAccount([demoAccount]);

    expect(selected).toEqual(demoAccount);
    expect(getDashboardSource(selected)).toBe("demo");
  });

  it("selects accounts strictly for the active environment", () => {
    expect(selectEnvironmentAccount([demoAccount, mt5Account], true)).toEqual(
      mt5Account,
    );
    expect(selectEnvironmentAccount([demoAccount, mt5Account], false)).toEqual(
      demoAccount,
    );
    expect(selectEnvironmentAccount([demoAccount], true)).toBeNull();
  });

  it("does not mix demo candles into an MT5 dashboard", () => {
    const baseCandle = {
      id: "candle",
      symbol_id: "eurusd",
      timeframe: "H1",
      open_time: "2026-08-01T12:00:00Z",
      open: "1.10",
      high: "1.11",
      low: "1.09",
      close: "1.105",
      volume: "100",
    };
    const candles = [
      { ...baseCandle, id: "demo-candle", source: "demo" as const },
      { ...baseCandle, id: "mt5-candle", source: "mt5" as const },
    ];

    expect(selectSourceCandles(candles, "mt5").map((candle) => candle.id)).toEqual([
      "mt5-candle",
    ]);
  });

  it("builds and updates only the current H1 candle from sequential quotes", () => {
    const candle: CandleRecord = {
      id: "stored",
      symbol_id: "eurusd",
      timeframe: "H1",
      open_time: "2026-08-01T11:00:00.000Z",
      open: "1.08000",
      high: "1.08500",
      low: "1.07900",
      close: "1.08200",
      volume: "100",
      source: "mt5",
    };
    const quote = (bid: string, ask: string, observed_at: string): QuoteRecord => ({
      symbol_id: "eurusd",
      terminal_id: "terminal",
      bid,
      ask,
      observed_at,
      received_at: observed_at,
      source: "mt5",
    });

    const first = mergeLiveQuotes(
      [candle],
      [quote("1.08300", "1.08320", "2026-08-01T12:15:00.000Z")],
    );
    const second = mergeLiveQuotes(
      first,
      [quote("1.08600", "1.08620", "2026-08-01T12:20:00.000Z")],
    );
    const live = second.find((item) => item.id.startsWith("live:"));

    expect(live).toMatchObject({
      open_time: "2026-08-01T12:00:00.000Z",
      open: "1.08200",
      high: "1.0861",
      low: "1.082",
      close: "1.08610",
    });
  });

  it("does not apply a quote to a future candle", () => {
    const candle: CandleRecord = {
      id: "stored",
      symbol_id: "eurusd",
      timeframe: "H1",
      open_time: "2026-08-01T12:00:00.000Z",
      open: "1.08000",
      high: "1.08500",
      low: "1.07900",
      close: "1.08200",
      volume: "100",
      source: "mt5",
    };
    const result = mergeLiveQuotes([candle], [
      {
        symbol_id: "eurusd",
        terminal_id: "terminal",
        bid: "1.09000",
        ask: "1.09020",
        observed_at: "2026-08-01T11:59:59.000Z",
        received_at: "2026-08-01T12:00:00.000Z",
        source: "mt5",
      },
    ]);

    expect(result).toEqual([candle]);
  });

  it("adds every quoted active currency pair without treating metals as forex", () => {
    const symbol = (id: string, name: string): SymbolRecord => ({
      id,
      name,
      description: name,
      digits: 5,
      is_active: true,
      volume_min: "0.01",
      volume_step: "0.01",
      volume_max: "99",
      contract_size: "100000",
    });
    const quote = (symbolId: string): QuoteRecord => ({
      symbol_id: symbolId,
      terminal_id: "terminal",
      bid: "1.10000",
      ask: "1.10020",
      observed_at: "2026-08-20T10:00:00Z",
      received_at: "2026-08-20T10:00:00Z",
      source: "mt5",
    });

    const result = buildMarketSeries(
      [],
      [
        symbol("eurusd", "EURUSD"),
        symbol("bgnusd", "BGNUSD"),
        symbol("gbpjpy", "GBPJPY.pro"),
        symbol("xauusd", "XAUUSD"),
      ],
      [],
      [quote("eurusd"), quote("bgnusd"), quote("gbpjpy"), quote("xauusd")],
    );

    expect(result).toHaveLength(21);
    expect(result.filter((series) => series.symbol.id === "eurusd").map(
      (series) => series.timeframe,
    )).toEqual(["M1", "M5", "M15", "M30", "H1", "H4", "D1"]);
    expect(result.some((series) => series.symbol.id === "xauusd")).toBe(false);
  });

  it("calculates realized net P&L and win rate from closed trades only", () => {
    const trade = (
      id: string,
      profit: string,
      commission: string,
      swap: string,
      status: TradeRecord["status"] = "closed",
    ): TradeRecord => ({
      id,
      account_id: "mt5",
      symbol_id: "eurusd",
      external_id: id,
      side: "buy",
      volume: "0.10",
      open_price: "1.10000",
      close_price: status === "closed" ? "1.10100" : null,
      opened_at: "2026-08-20T10:00:00Z",
      closed_at: status === "closed" ? "2026-08-20T11:00:00Z" : null,
      profit,
      commission,
      swap,
      status,
    });

    expect(calculatePortfolioMetrics([
      trade("winner", "100", "-10", "-5"),
      trade("loser", "-20", "-2", "0"),
      trade("open", "999", "0", "0", "open"),
    ])).toEqual({
      closedTrades: 2,
      realizedNetProfit: 63,
      winRate: 50,
    });
  });
});
