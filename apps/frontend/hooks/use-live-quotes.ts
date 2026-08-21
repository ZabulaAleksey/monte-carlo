"use client";

import { apiClient } from "@/lib/api/client";
import type { QuoteRecord } from "@/lib/api/types";
import { usePollingQuery } from "./use-polling-query";

const DEFAULT_INTERVAL_MS = 500;

interface LiveQuotesQuery {
  quotes: QuoteRecord[];
  error: string | null;
}

export function useLiveQuotes(
  enabled: boolean,
  intervalMs = DEFAULT_INTERVAL_MS,
): LiveQuotesQuery {
  const query = usePollingQuery<QuoteRecord[]>({
    enabled,
    initialData: [],
    intervalMs,
    loader: () => apiClient.getQuotes(),
  });
  return { quotes: query.data ?? [], error: query.error };
}
