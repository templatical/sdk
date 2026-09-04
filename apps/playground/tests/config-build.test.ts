import { describe, expect, it } from "vitest";
import { buildCapabilityConfig, methodOr } from "../src/config/build";
import type { CapabilityDef, ControlState } from "../src/config/types";

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

describe("buildCapabilityConfig impl argument", () => {
  it("hands the implementation to build as its second argument", () => {
    const impl = { marker: "live-provider" };
    const def: CapabilityDef<typeof impl> = {
      id: "impl-demo",
      group: "backend",
      title: "Impl demo",
      blurb: "Takes an implementation.",
      fixture: "product-launch",
      controls: [],
      build: (_state, received) => ({ locale: received.marker }),
    };
    expect(buildCapabilityConfig(def, {}, impl)).toEqual({
      locale: "live-provider",
    });
  });

  it("keeps control state free of the implementation", () => {
    const seen: ControlState[] = [];
    const def: CapabilityDef<{ marker: string }> = {
      id: "state-purity",
      group: "backend",
      title: "State purity",
      blurb: "Records the state it was given.",
      fixture: "product-launch",
      controls: [
        { kind: "boolean", path: "flag", label: "Flag", help: "", default: true },
      ],
      build: (state, _impl) => {
        seen.push(state);
        return {};
      },
    };
    buildCapabilityConfig(def, {}, { marker: "live-provider" });
    expect(seen).toEqual([{ flag: true }]);
    expect(JSON.stringify(seen[0])).toBe('{"flag":true}');
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
