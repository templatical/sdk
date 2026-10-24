import { describe, expect, it } from "vitest";
import { INIT_TIMEOUT_MS } from "../src/constants/timeouts";

describe("timeout constants", () => {
  it("INIT_TIMEOUT_MS is 30 seconds", () => {
    expect(INIT_TIMEOUT_MS).toBe(30000);
  });
});
