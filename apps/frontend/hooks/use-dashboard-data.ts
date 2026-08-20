"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiClient } from "@/lib/api/client";
import { mergeDashboardSnapshot } from "@/lib/dashboard";
import type { DashboardSnapshot } from "@/lib/dashboard";

const REFRESH_INTERVAL_MS = 15_000;
const QUOTE_REFRESH_INTERVAL_MS = 500;

export interface DashboardQuery {
  data: DashboardSnapshot | null;
  error: string | null;
  loadCandles: (symbolId: string, timeframe: string) => Promise<void>;
}

async function loadDashboard(): Promise<DashboardSnapshot> {
  const [accounts, candles, symbols, trades, quotes] = await Promise.all([
    apiClient.getAccounts(),
    apiClient.getCandles(500),
    apiClient.getSymbols(),
    apiClient.getTrades(),
    apiClient.getQuotes(),
  ]);
  return { accounts, candles, symbols, trades, quotes };
}

export function useDashboardData(): DashboardQuery {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedSeries = useRef(new Set<string>());
  const mounted = useRef(true);

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
    try {
      const candles = await apiClient.getCandles({
        limit: 500,
        symbolId,
        timeframe,
      });
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
      setError(null);
    } catch (reason: unknown) {
      requestedSeries.current.delete(key);
      if (mounted.current) {
        setError(reason instanceof Error ? reason.message : "Unknown error");
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    const refresh = async (): Promise<void> => {
      try {
        const snapshot = await loadDashboard();
        if (active) {
          setData((previous) => {
            const retainedSelected = previous?.candles.filter((candle) =>
              requestedSeries.current.has(`${candle.symbol_id}:${candle.timeframe}`),
            ) ?? [];
            return mergeDashboardSnapshot(previous, {
              ...snapshot,
              candles: [...retainedSelected, ...snapshot.candles],
            });
          });
          setError(null);
        }
      } catch (reason: unknown) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unknown error");
        }
      }
    };

    void refresh();
    const intervalId = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;

    const refreshQuotes = async (): Promise<void> => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const quotes = await apiClient.getQuotes();
        if (active) {
          setData((previous) =>
            previous
              ? mergeDashboardSnapshot(previous, { ...previous, quotes })
              : previous,
          );
          setError(null);
        }
      } catch (reason: unknown) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unknown error");
        }
      } finally {
        inFlight = false;
      }
    };

    const intervalId = window.setInterval(
      () => void refreshQuotes(),
      QUOTE_REFRESH_INTERVAL_MS,
    );
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return { data, error, loadCandles };
}
