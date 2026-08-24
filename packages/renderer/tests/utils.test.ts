import { describe, expect, it } from "vitest";
import { bgAttr, heightAttr } from "../src/utils";

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

describe("heightAttr", () => {
  it("emits a px unit, which MJML's Unit attribute requires", () => {
    expect(heightAttr(180)).toBe(' height="180px"');
  });

  it("returns empty string when no height is set, leaving MJML's auto", () => {
    expect(heightAttr(undefined)).toBe("");
  });

  it("treats zero, negative and non-finite heights as unset", () => {
    // A caller reaching the renderer directly can hand over any number. `0`
    // would collapse the image, and `height="NaNpx"` is a validation error
    // that makes MJML drop the attribute anyway — no opinion is the safe read.
    expect(heightAttr(0)).toBe("");
    expect(heightAttr(-40)).toBe("");
    expect(heightAttr(Number.NaN)).toBe("");
    expect(heightAttr(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("includes leading space so it can be interpolated into a tag's attribute list", () => {
    expect(heightAttr(180).startsWith(" ")).toBe(true);
  });
});
