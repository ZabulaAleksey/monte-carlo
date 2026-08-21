"use client";

import {
  createContext,
  useContext,
  useMemo,
} from "react";

import { apiClient } from "@/lib/api/client";
import type { Mt5Status } from "@/lib/api/types";
import { usePollingQuery } from "./use-polling-query";

const STATUS_REFRESH_INTERVAL_MS = 5_000;

interface Mt5StatusContextValue {
  error: string | null;
  status: Mt5Status | null;
}

const Mt5StatusContext = createContext<Mt5StatusContextValue | null>(null);

export function Mt5StatusProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { data: status, error } = usePollingQuery<Mt5Status>({
    intervalMs: STATUS_REFRESH_INTERVAL_MS,
    loader: () => apiClient.getMt5Status(),
  });

  const value = useMemo(() => ({ error, status }), [error, status]);
  return (
    <Mt5StatusContext.Provider value={value}>
      {children}
    </Mt5StatusContext.Provider>
  );
}

export function useMt5Status(): Mt5StatusContextValue {
  const context = useContext(Mt5StatusContext);
  if (!context) {
    throw new Error("useMt5Status must be used inside Mt5StatusProvider");
  }
  return context;
}
