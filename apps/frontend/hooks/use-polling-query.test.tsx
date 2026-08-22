import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePollingQuery } from "./use-polling-query";

describe("usePollingQuery", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("prevents overlapping requests and keeps the last successful snapshot", async () => {
    let resolveFirst: ((value: number) => void) | undefined;
    const loader = vi.fn()
      .mockImplementationOnce(() => new Promise<number>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockRejectedValueOnce(new Error("temporary"));
    const { result } = renderHook(() => usePollingQuery({
      intervalMs: 100,
      loader,
    }));

    await act(async () => vi.advanceTimersByTime(300));
    expect(loader).toHaveBeenCalledTimes(1);
    await act(async () => resolveFirst?.(7));
    expect(result.current.data).toBe(7);
    await act(async () => vi.advanceTimersByTime(100));
    expect(result.current.data).toBe(7);
    expect(result.current.error).toBe("temporary");
  });

  it("stops polling after unmount", async () => {
    const loader = vi.fn().mockResolvedValue(1);
    const { unmount } = renderHook(() => usePollingQuery({ intervalMs: 100, loader }));
    await act(async () => Promise.resolve());
    unmount();
    await act(async () => vi.advanceTimersByTime(500));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("ignores a response from an obsolete query key", async () => {
    let resolveOld: ((value: string) => void) | undefined;
    const loaders = {
      old: () => new Promise<string>((resolve) => { resolveOld = resolve; }),
      next: vi.fn().mockResolvedValue("new snapshot"),
    };
    const initialProps: { key: keyof typeof loaders } = { key: "old" };
    const { result, rerender } = renderHook(
      ({ key }: { key: keyof typeof loaders }) => usePollingQuery({
        intervalMs: 100,
        loader: loaders[key],
        queryKey: key,
      }),
      { initialProps },
    );

    rerender({ key: "next" });
    await act(async () => Promise.resolve());
    expect(result.current.data).toBe("new snapshot");
    await act(async () => resolveOld?.("obsolete snapshot"));
    expect(result.current.data).toBe("new snapshot");
  });
});
