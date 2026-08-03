"use client";

import { useEffect, useState } from "react";

const DEFAULT_REFRESH_INTERVAL_MS = 15_000;

export interface PollingQuery<T> {
  data: T | null;
  error: string | null;
}

export function usePollingQuery<T>(
  loader: () => Promise<T>,
  intervalMs = DEFAULT_REFRESH_INTERVAL_MS,
): PollingQuery<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = async (): Promise<void> => {
      try {
        const result = await loader();
        if (active) {
          setData(result);
          setError(null);
        }
      } catch (reason: unknown) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unknown error");
        }
      }
    };

    void refresh();
    const intervalId = window.setInterval(() => void refresh(), intervalMs);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [intervalMs, loader]);

  return { data, error };
}
