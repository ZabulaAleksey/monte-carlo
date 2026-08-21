import { describe, expect, it } from "vitest";

import { buildMt5ConnectionViewModel } from "./mt5-connection";

describe("MT5 connection view model", () => {
  it("separates transport failures from terminal state", () => {
    expect(buildMt5ConnectionViewModel(null).state).toBe("checking");
    expect(buildMt5ConnectionViewModel(null, "offline").state).toBe("backend-unavailable");
  });
});
