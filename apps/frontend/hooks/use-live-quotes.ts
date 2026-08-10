"use client";

import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api/client";
import type { QuoteRecord } from "@/lib/api/types";

const DEFAULT_INTERVAL_MS = 500;

interface LiveQuotesQuery {
  quotes: QuoteRecord[];
  error: string | null;
}

export function useLiveQuotes(
  enabled: boolean,
  intervalMs = DEFAULT_INTERVAL_MS,
): LiveQuotesQuery {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let inFlight = false;

    const refresh = async (): Promise<void> => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const nextQuotes = await apiClient.getQuotes();
        if (active) {
          setQuotes(nextQuotes);
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

    void refresh();
    const intervalId = window.setInterval(() => void refresh(), intervalMs);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs]);

  return { quotes, error };
}
