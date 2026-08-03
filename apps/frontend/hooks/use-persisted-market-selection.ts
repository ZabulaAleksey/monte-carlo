"use client";

import { useCallback, useEffect, useState } from "react";

export const MARKET_SELECTION_STORAGE_KEY = "montecarlo.market-pulse.series";

export interface PersistedMarketSelection {
  selectedSeriesKey: string | null;
  selectSeries: (seriesKey: string) => void;
}

export function usePersistedMarketSelection(): PersistedMarketSelection {
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSelectedSeriesKey(window.localStorage.getItem(MARKET_SELECTION_STORAGE_KEY));
    } catch {
      // Storage can be unavailable in privacy modes. The selector still works in memory.
    }
  }, []);

  const selectSeries = useCallback((seriesKey: string): void => {
    setSelectedSeriesKey(seriesKey);
    try {
      window.localStorage.setItem(MARKET_SELECTION_STORAGE_KEY, seriesKey);
    } catch {
      // Storage failures must not make the dashboard unusable.
    }
  }, []);

  return { selectedSeriesKey, selectSeries };
}
