import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLiveQuotes } from "./use-live-quotes";

vi.mock("@/lib/api/client", () => ({
  apiClient: { getQuotes: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";

describe("useLiveQuotes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not request ticks when its route-scoped subscription is disabled", () => {
    renderHook(() => useLiveQuotes(false));

    expect(apiClient.getQuotes).not.toHaveBeenCalled();
  });

  it("polls while mounted and clears the tick timer on navigation", async () => {
    vi.mocked(apiClient.getQuotes).mockResolvedValue([]);
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = renderHook(() => useLiveQuotes(true));

    await waitFor(() => expect(apiClient.getQuotes).toHaveBeenCalledTimes(1));
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 500);

    const intervalId = setIntervalSpy.mock.results[0]?.value;
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
  });
});
