"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PollingQueryOptions<T> {
  enabled?: boolean;
  initialData?: T | null;
  immediate?: boolean;
  intervalMs: number;
  loader: () => Promise<T>;
  pauseWhenHidden?: boolean;
  queryKey?: string | number | boolean | null;
}

export interface PollingQuery<T> {
  data: T | null;
  error: string | null;
  initialLoading: boolean;
  refresh: () => Promise<void>;
  refreshing: boolean;
}

export function usePollingQuery<T>({
  enabled = true,
  initialData = null,
  immediate = true,
  intervalMs,
  loader,
  pauseWhenHidden = true,
  queryKey = null,
}: PollingQueryOptions<T>): PollingQuery<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  const generationRef = useRef(0);
  const inFlightRef = useRef(false);
  loaderRef.current = loader;

  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled || inFlightRef.current) return;
    if (pauseWhenHidden && document.visibilityState === "hidden") return;
    const generation = generationRef.current;
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      const next = await loaderRef.current();
      if (generation === generationRef.current) {
        setData(next);
        setError(null);
      }
    } catch (reason: unknown) {
      if (generation === generationRef.current) {
        setError(reason instanceof Error ? reason.message : "Unknown error");
      }
    } finally {
      if (generation === generationRef.current) {
        setRefreshing(false);
        inFlightRef.current = false;
      }
    }
  }, [enabled, pauseWhenHidden]);

  useEffect(() => {
    generationRef.current += 1;
    inFlightRef.current = false;
    if (!enabled) return;
    if (immediate) void refresh();
    const intervalId = window.setInterval(() => void refresh(), intervalMs);
    return () => {
      generationRef.current += 1;
      window.clearInterval(intervalId);
    };
  }, [enabled, immediate, intervalMs, queryKey, refresh]);

  return {
    data,
    error,
    initialLoading: enabled && data === null,
    refresh,
    refreshing,
  };
}
