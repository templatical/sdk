import { describe, expect, it } from "vitest";
import { buildCapabilityConfig, methodOr } from "../src/config/build";
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

  it("passes a key the controls don't name through to build untouched", () => {
    const passthroughDef: CapabilityDef = {
      id: "passthrough-demo",
      group: "backend",
      title: "Passthrough Demo",
      blurb: "A demo capability with no controls of its own.",
      fixture: "product-launch",
      controls: [],
      build: (state) => ({ savedBlocks: state["__impl"] }),
    };
    const impl = { list: async () => [] };

    const config = buildCapabilityConfig(passthroughDef, { __impl: impl });
    expect(config).toEqual({ savedBlocks: impl });
  });
});

describe("methodOr", () => {
  const impl = async () => "stored";

  it("passes the implementation through when the control is on", () => {
    expect(methodOr(true, impl)).toBe(impl);
  });

  it("returns literal false when the control is off", () => {
    expect(methodOr(false, impl)).toBe(false);
  });

  it("treats an absent value as off rather than passing undefined into config", () => {
    expect(methodOr(undefined, impl)).toBe(false);
  });
});
