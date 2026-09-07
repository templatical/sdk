import { describe, expect, it } from "vitest";
import { buildCapabilityConfig } from "../src/config/build";
import { renderCapability } from "../src/config/capabilities/render";
import { compileMjmlDemo } from "../src/providers/render";

describe("renderCapability", () => {
  it("supplies compileMjml by default, so toHtml() resolves", () => {
    const config = buildCapabilityConfig(renderCapability, {}, undefined);
    expect(config.render?.compileMjml).toBe(compileMjmlDemo);
  });

  it("omits it when the control is off, which is what makes toHtml() throw", () => {
    // The key is ABSENT, not `false`. `RenderProvider.compileMjml` is
    // `compileMjml?(mjml): Promise<string>` — optional, with no `false` in
    // the union — so `false` would not typecheck, and `undefined` present as
    // a key is indistinguishable from omitted to the SDK anyway. Asserting
    // the key set rather than the value is what pins "omitted".
    const config = buildCapabilityConfig(
      renderCapability,
      { "render.compileMjml": false },
      undefined,
    );
    expect(Object.keys(config.render ?? {})).toEqual([]);
  });

  it("supplies only compileMjml — the tier a consumer with no backend reaches", () => {
    const config = buildCapabilityConfig(renderCapability, {}, undefined);
    expect(Object.keys(config.render ?? {})).toEqual(["compileMjml"]);
  });

  it("wraps no provider", () => {
    expect(renderCapability.implFor).toBeUndefined();
  });
});
