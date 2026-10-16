import { describe, expect, it } from "vitest";
import { uniformBorder } from "@templatical/types";
import type { BorderValue, SpacingValue } from "@templatical/types";
import { RenderContext } from "../src/render-context";
import {
  bgAttr,
  fluidOnMobileAttr,
  heightAttr,
  horizontalInset,
} from "../src/utils";

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

const pad = (left: number, right: number): SpacingValue => ({
  top: 0,
  right,
  bottom: 0,
  left,
});

describe("horizontalInset", () => {
  it("sums side padding and the left and right borders", () => {
    const border = uniformBorder({ width: 3, style: "solid", color: "#000" });
    expect(horizontalInset(pad(10, 15), border)).toBe(31);
  });

  it("ignores top and bottom", () => {
    expect(
      horizontalInset({ top: 40, right: 5, bottom: 40, left: 5 }),
    ).toBe(10);
  });

  it("counts only the sides that are drawn", () => {
    const border: BorderValue = {
      ...uniformBorder({ width: 4, style: "solid", color: "#000" }),
      right: { width: 0, style: "solid", color: "#000" },
    };
    expect(horizontalInset(pad(0, 0), border)).toBe(4);
  });

  it("is 0 with nothing around the box", () => {
    expect(horizontalInset(undefined)).toBe(0);
    expect(horizontalInset(pad(0, 0), undefined)).toBe(0);
  });
});

describe("fluidOnMobileAttr", () => {
  // A column whose nominal share is 300px but which MJML gives 260px.
  const ctx = new RenderContext(
    300,
    [],
    "Arial, sans-serif",
    true,
    undefined,
    undefined,
    undefined,
    undefined,
    260,
  );
  const image = (width: number | "full", border?: BorderValue) => ({
    width,
    styles: { padding: pad(10, 10) },
    border,
  });

  it('is set on a "full" image', () => {
    expect(fluidOnMobileAttr(image("full"), ctx)).toBe(
      ' fluid-on-mobile="true"',
    );
  });

  it("is set from the room inside the image's padding, up", () => {
    expect(fluidOnMobileAttr(image(240), ctx)).toBe(' fluid-on-mobile="true"');
    expect(fluidOnMobileAttr(image(600), ctx)).toBe(' fluid-on-mobile="true"');
    expect(fluidOnMobileAttr(image(239), ctx)).toBe("");
  });

  it("reads contentWidth, not the nominal containerWidth", () => {
    // 270 is under the nominal 300 − 20 but over the real 260 − 20.
    expect(fluidOnMobileAttr(image(270), ctx)).toBe(' fluid-on-mobile="true"');
  });

  it("takes the image's own border off the room", () => {
    const border = uniformBorder({ width: 4, style: "solid", color: "#000" });
    expect(fluidOnMobileAttr(image(232, border), ctx)).toBe(
      ' fluid-on-mobile="true"',
    );
    expect(fluidOnMobileAttr(image(231, border), ctx)).toBe("");
  });

  it("floors a fractional contentWidth as MJML does", () => {
    const fractional = ctx.withContainerWidth(300, 260.9);
    expect(fluidOnMobileAttr(image(240), fractional)).toBe(
      ' fluid-on-mobile="true"',
    );
    expect(fluidOnMobileAttr(image(239), fractional)).toBe("");
  });

  it("is never set on a narrow image", () => {
    expect(fluidOnMobileAttr(image(120), ctx)).toBe("");
  });
});
