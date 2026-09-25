import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveShadowDom } from "../src/host/shadowMode";

function stubLocation(search: string, stored: string | null = null) {
  vi.stubGlobal("window", {
    location: { search },
    localStorage: { getItem: () => stored },
  });
}

describe("resolveShadowDom", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to shadow DOM, the SDK default", () => {
    stubLocation("");
    expect(resolveShadowDom()).toBe(true);
  });

  it.each([
    ["?shadowDom=0", false],
    ["?shadowDom=false", false],
    ["?shadowDom=1", true],
    ["?shadowDom=true", true],
  ])("%s pins the mode", (search, expected) => {
    stubLocation(search);
    expect(resolveShadowDom()).toBe(expected);
  });

  it("ignores a stored light-DOM choice from the removed header toggle", () => {
    // With no control left to change it, honouring the stored value would
    // strand the visitor in light DOM on every scene.
    stubLocation("", "light");
    expect(resolveShadowDom()).toBe(true);
  });
});
