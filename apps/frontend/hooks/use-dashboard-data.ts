"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiClient } from "@/lib/api/client";
import { mergeDashboardSnapshot } from "@/lib/dashboard";
import type { DashboardSnapshot } from "@/lib/dashboard";
import { usePollingQuery } from "./use-polling-query";

const REFRESH_INTERVAL_MS = 15_000;
const QUOTE_REFRESH_INTERVAL_MS = 500;
const METRICS_REFRESH_INTERVAL_MS = 2_000;
const DASHBOARD_TRADES_LIMIT = 2_000;
const HISTORY_POLL_INTERVAL_MS = 1_000;
const DASHBOARD_CANDLE_LIMIT = 500;

const TIMEFRAME_MILLISECONDS: Record<string, number> = {
  M1: 60_000,
  M5: 5 * 60_000,
  M15: 15 * 60_000,
  M30: 30 * 60_000,
  H1: 60 * 60_000,
  H4: 4 * 60 * 60_000,
  D1: 24 * 60 * 60_000,
};

export interface DashboardQuery {
  data: DashboardSnapshot | null;
  error: string | null;
  loadingSeriesKey: string | null;
  loadCandles: (symbolId: string, timeframe: string) => Promise<void>;
}

function requestedCandleRange(timeframe: string): { startAt: string; endAt: string } {
  const duration = TIMEFRAME_MILLISECONDS[timeframe.toUpperCase()]
    ?? 60 * 60_000;
  const end = Math.floor(Date.now() / duration) * duration;
  return {
    startAt: new Date(end - duration * DASHBOARD_CANDLE_LIMIT).toISOString(),
    endAt: new Date(end).toISOString(),
  };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function loadDashboard(): Promise<DashboardSnapshot> {
  const [accounts, candles, symbols, trades, quotes] = await Promise.all([
    apiClient.getAccounts(),
    apiClient.getCandles(500),
    apiClient.getSymbols(),
    apiClient.getTrades(DASHBOARD_TRADES_LIMIT),
    apiClient.getQuotes(),
  ]);
  return { accounts, candles, symbols, trades, quotes };
}

async function loadDashboardMetrics(): Promise<Pick<DashboardSnapshot, "accounts" | "trades">> {
  const [accounts, trades] = await Promise.all([
    apiClient.getAccounts(),
    apiClient.getTrades(DASHBOARD_TRADES_LIMIT),
  ]);
  return { accounts, trades };
}

export function useDashboardData(): DashboardQuery {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [loadingSeriesKey, setLoadingSeriesKey] = useState<string | null>(null);
  const requestedSeries = useRef(new Set<string>());
  const mounted = useRef(true);
  const snapshotQuery = usePollingQuery<DashboardSnapshot>({
    intervalMs: REFRESH_INTERVAL_MS,
    loader: loadDashboard,
  });
  const metricsQuery = usePollingQuery<Pick<DashboardSnapshot, "accounts" | "trades">>({
    immediate: false,
    intervalMs: METRICS_REFRESH_INTERVAL_MS,
    loader: loadDashboardMetrics,
  });
  const quotesQuery = usePollingQuery<DashboardSnapshot["quotes"]>({
    immediate: false,
    intervalMs: QUOTE_REFRESH_INTERVAL_MS,
    loader: () => apiClient.getQuotes(),
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadCandles = useCallback(async (
    symbolId: string,
    timeframe: string,
  ): Promise<void> => {
    const key = `${symbolId}:${timeframe}`;
    if (requestedSeries.current.has(key)) return;
    requestedSeries.current.add(key);
    setLoadingSeriesKey(key);
    try {
      let candles = await apiClient.getCandles({
        limit: DASHBOARD_CANDLE_LIMIT,
        symbolId,
        timeframe,
        source: "mt5",
      });
      if (candles.length === 0) {
        const { startAt, endAt } = requestedCandleRange(timeframe);
        let request = await apiClient.requestHistoricalData(
          symbolId,
          timeframe,
          startAt,
          endAt,
        );
        while (
          mounted.current &&
          request.status !== "completed" &&
          request.status !== "failed"
        ) {
          await wait(HISTORY_POLL_INTERVAL_MS);
          if (!mounted.current) return;
          request = await apiClient.getHistoricalDataRequest(request.id);
        }
        if (request.status === "failed") {
          throw new Error(request.error ?? "MT5 historical data request failed");
        }
        candles = await apiClient.getCandles({
          limit: DASHBOARD_CANDLE_LIMIT,
          symbolId,
          timeframe,
          source: "mt5",
        });
      }
      if (!mounted.current) return;
      setData((previous) => {
        if (!previous) return previous;
        const byId = new Map(
          [...previous.candles, ...candles].map((candle) => [candle.id, candle]),
        );
        return mergeDashboardSnapshot(previous, {
          ...previous,
          candles: [...byId.values()],
        });
      });
      setSeriesError(null);
    } catch (reason: unknown) {
      requestedSeries.current.delete(key);
      if (mounted.current) {
        setSeriesError(reason instanceof Error ? reason.message : "Unknown error");
      }
    } finally {
      if (mounted.current) {
        setLoadingSeriesKey((current) => current === key ? null : current);
      }
    }
  }, []);

  useEffect(() => {
    const metrics = metricsQuery.data;
    if (!metrics) return;
    setData((previous) => previous
      ? { ...previous, ...metrics }
      : { ...metrics, candles: [], quotes: [], symbols: [] });
  }, [metricsQuery.data]);

  useEffect(() => {
    const snapshot = snapshotQuery.data;
    if (!snapshot) return;
    setData((previous) => {
      const retainedSelected = previous?.candles.filter((candle) =>
        requestedSeries.current.has(`${candle.symbol_id}:${candle.timeframe}`),
      ) ?? [];
      const merged = mergeDashboardSnapshot(previous, {
        ...snapshot,
        candles: [...retainedSelected, ...snapshot.candles],
      });
      return previous
        ? { ...merged, accounts: previous.accounts, trades: previous.trades }
        : merged;
    });
  }, [snapshotQuery.data]);

  useEffect(() => {
    if (!quotesQuery.data) return;
    setData((previous) => previous
      ? mergeDashboardSnapshot(previous, { ...previous, quotes: quotesQuery.data ?? [] })
      : previous);
  }, [quotesQuery.data]);

  const error = seriesError
    ?? metricsQuery.error
    ?? snapshotQuery.error
    ?? quotesQuery.error;
  return { data, error, loadingSeriesKey, loadCandles };
}
