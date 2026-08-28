import { describe, expect, it } from "vitest";

describe("playground test harness", () => {
  it("runs and resolves the app's own source", async () => {
    const mod = await import("../src/templates");
    expect(Array.isArray(mod.templates)).toBe(true);
    expect(mod.templates.length).toBe(7);
    expect(mod.templates[0].name).toBe("Product Launch");
  });
});
