import { describe, expect, it } from "vitest";
import { buildCapabilityConfig } from "../src/config/build";
import { shadowDomCapability } from "../src/config/capabilities/shadow-dom";

describe("shadowDomCapability", () => {
  it("defaults to shadow, the SDK's own default", () => {
    const config = buildCapabilityConfig(shadowDomCapability, {}, undefined);
    expect(config.shadowDom).toBe(true);
  });

  it("maps the light option onto shadowDom false", () => {
    const config = buildCapabilityConfig(
      shadowDomCapability,
      { "shadowDom.mode": "light" },
      undefined,
    );
    expect(config.shadowDom).toBe(false);
  });

  it("offers exactly the two mount modes", () => {
    const [control] = shadowDomCapability.controls;
    expect(control.kind).toBe("enum");
    expect(control.kind === "enum" && control.options).toEqual([
      "shadow",
      "light",
    ]);
  });

  it("wraps no provider", () => {
    expect(shadowDomCapability.implFor).toBeUndefined();
  });
});
