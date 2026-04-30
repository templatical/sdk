import { describe, expect, it } from "vitest";
import { bgAttr } from "../src/utils";

describe("bgAttr", () => {
  it("returns empty string when no color", () => {
    expect(bgAttr(undefined, "container")).toBe("");
    expect(bgAttr(undefined, "native")).toBe("");
    expect(bgAttr("", "container")).toBe("");
    expect(bgAttr("", "native")).toBe("");
  });

  it("emits container-background-color for container placement", () => {
    expect(bgAttr("#ff0000", "container")).toBe(
      ' container-background-color="#ff0000"',
    );
  });

  it("emits background-color for native placement", () => {
    expect(bgAttr("#ff0000", "native")).toBe(' background-color="#ff0000"');
  });

  it("preserves color value verbatim including non-hex formats", () => {
    expect(bgAttr("rgb(255, 251, 235)", "container")).toBe(
      ' container-background-color="rgb(255, 251, 235)"',
    );
    expect(bgAttr("rgba(0,0,0,0.5)", "native")).toBe(
      ' background-color="rgba(0,0,0,0.5)"',
    );
  });

  it("includes leading space so it can be interpolated into a tag's attribute list", () => {
    const result = bgAttr("#fff", "container");
    expect(result.startsWith(" ")).toBe(true);
  });
});
