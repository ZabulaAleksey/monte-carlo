"use client";

import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api/client";
import type { DashboardSnapshot } from "@/lib/dashboard";

const REFRESH_INTERVAL_MS = 15_000;

export interface DashboardQuery {
  data: DashboardSnapshot | null;
  error: string | null;
}

async function loadDashboard(): Promise<DashboardSnapshot> {
  const [accounts, candles, symbols, trades, mt5] = await Promise.all([
    apiClient.getAccounts(),
    apiClient.getCandles(500),
    apiClient.getSymbols(),
    apiClient.getTrades(),
    apiClient.getMt5Status(),
  ]);
  return { accounts, candles, symbols, trades, mt5 };
}

export function useDashboardData(): DashboardQuery {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = async (): Promise<void> => {
      try {
        const snapshot = await loadDashboard();
        if (active) {
          setData(snapshot);
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

  return { data, error };
}
