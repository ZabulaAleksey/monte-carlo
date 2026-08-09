"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiClient } from "@/lib/api/client";
import type { Mt5Status } from "@/lib/api/types";

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
  const [status, setStatus] = useState<Mt5Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = async (): Promise<void> => {
      try {
        const nextStatus = await apiClient.getMt5Status();
        if (active) {
          setStatus(nextStatus);
          setError(null);
        }
      } catch (reason: unknown) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Unknown error");
        }
      }
    };

    void refresh();
    const intervalId = window.setInterval(() => void refresh(), STATUS_REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

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
