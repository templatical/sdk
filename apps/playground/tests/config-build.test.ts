import { describe, expect, it } from "vitest";
import { buildCapabilityConfig } from "../src/config/build";
import type { CapabilityDef } from "../src/config/types";

const def: CapabilityDef = {
  id: "demo",
  group: "backend",
  title: "Demo",
  blurb: "A demo capability.",
  fixture: "product-launch",
  controls: [
    { kind: "boolean", path: "autoSave", label: "Autosave", help: "" },
    { kind: "number", path: "autoSave.debounce", label: "Debounce", help: "", min: 500, max: 10000 },
  ],
  build: (state) => ({
    autoSave: state["autoSave"] === true ? { debounce: state["autoSave.debounce"] as number } : false,
  }),
};

describe("buildCapabilityConfig", () => {
  it("passes control state to the definition's build and returns its config", () => {
    const config = buildCapabilityConfig(def, { autoSave: true, "autoSave.debounce": 2000 });
    expect(config).toEqual({ autoSave: { debounce: 2000 } });
  });

  it("reflects a changed control in the produced config", () => {
    const config = buildCapabilityConfig(def, { autoSave: false });
    expect(config).toEqual({ autoSave: false });
  });

  it("seeds missing control state from each control's default", () => {
    const config = buildCapabilityConfig(def, {});
    expect(config).toEqual({ autoSave: false });
  });
});
