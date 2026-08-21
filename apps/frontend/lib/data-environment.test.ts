import { describe, expect, it } from "vitest";

import type { AccountRecord } from "./api/types";
import {
  isDemoAccount,
  resolveAccountEnvironment,
  selectEnvironmentAccount,
} from "./data-environment";

const account = (id: string, externalId: string): AccountRecord => ({
  id,
  external_id: externalId,
  name: externalId,
  currency: "USD",
  balance: "1000",
  created_at: `2026-01-0${id}T00:00:00Z`,
});

describe("data environment", () => {
  it("keeps account classification outside dashboard-specific code", () => {
    const demo = account("2", "DEMO-2");
    const live = account("1", "10001");

    expect(isDemoAccount(demo)).toBe(true);
    expect(resolveAccountEnvironment(live)).toBe("mt5");
    expect(selectEnvironmentAccount([demo, live], false)).toEqual(demo);
  });
});
