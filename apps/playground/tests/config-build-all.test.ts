import { describe, expect, it } from "vitest";
import {
  buildAllCapabilityConfig,
  capabilities,
} from "../src/config/capabilities";

describe("buildAllCapabilityConfig", () => {
  it("folds every registered capability into one config object", () => {
    const config = buildAllCapabilityConfig({});
    expect(Object.keys(config).sort()).toEqual([
      "comments",
      "savedBlocks",
      "templates",
      "versionHistory",
    ]);
  });

  it("gives every registered capability an implFor", () => {
    const missing = capabilities
      .filter((c) => typeof c.implFor !== "function")
      .map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it("applies control state to the capability it belongs to", () => {
    const config = buildAllCapabilityConfig({ "templates.save": false });
    expect(config.templates?.save).toBe(false);
    expect(config.comments?.create).not.toBe(false);
  });

  it("resolves each capability's own defaults when state is empty", () => {
    const config = buildAllCapabilityConfig({});
    expect(config.templates?.autoSave).toBe(false);
    expect(typeof config.savedBlocks?.list).toBe("function");
    expect(typeof config.comments?.setResolved).toBe("function");
  });
});
