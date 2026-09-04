import { describe, expect, it } from "vitest";

describe("playground vitest alias", () => {
  it("resolves @/ to src", async () => {
    const viaAlias = await import("@/config/state");
    expect(viaAlias.CONTROL_STATE_KEY).toBe("tpl-playground-config");
  });
});
