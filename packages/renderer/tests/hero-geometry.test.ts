import { describe, expect, it } from "vitest";
import type { AppliedHero, SpacingValue } from "@templatical/types";
import { heroGeometry } from "../src/hero-geometry";

function hero(overrides: Partial<AppliedHero>): AppliedHero {
  return {
    applied: true,
    image: {
      url: "https://cdn.test/hero.jpg",
      size: "cover",
      position: "center center",
      repeat: "no-repeat",
    },
    height: "image",
    verticalAlign: "middle",
    aspectRatio: 800 / 1200,
    ...overrides,
  };
}

const NO_PADDING: SpacingValue = { top: 0, right: 0, bottom: 0, left: 0 };

describe("heroGeometry", () => {
  // Classic Outlook on Windows ignores fluid-height and shrinks the box to its
  // content, so matching the image is a fixed height Outlook keeps.
  it("matches the image with a fixed height at the image's own height, the image drawn at the box width", () => {
    expect(heroGeometry(hero({}), 600, NO_PADDING)).toEqual({
      mode: "fixed-height",
      height: 400,
      backgroundWidth: 600,
      backgroundHeight: 400,
    });
  });

  it("keeps the image's shape in a narrowed box", () => {
    expect(heroGeometry(hero({}), 560, NO_PADDING)).toEqual({
      mode: "fixed-height",
      height: 373,
      backgroundWidth: 560,
      backgroundHeight: 373,
    });
  });

  it("gives a fixed height fixed-height, the image still at its own shape", () => {
    expect(heroGeometry(hero({ height: 300 }), 600, NO_PADDING)).toEqual({
      mode: "fixed-height",
      height: 300,
      backgroundWidth: 600,
      backgroundHeight: 400,
    });
  });

  it("sizes an unmeasured image to the fixed box", () => {
    expect(
      heroGeometry(hero({ height: 320, aspectRatio: null }), 600, NO_PADDING),
    ).toEqual({
      mode: "fixed-height",
      height: 320,
      backgroundWidth: 600,
      backgroundHeight: 320,
    });
  });

  it("never emits a zero-sized image or box", () => {
    const geometry = heroGeometry(hero({ aspectRatio: 0.0001 }), 600, NO_PADDING);
    expect(geometry.backgroundHeight).toBe(1);
    expect(geometry.height).toBe(1);
  });

  // MJML sizes the cell as height less the top and bottom padding, each read as
  // a whole pixel, and writes a negative height for a box shorter than that.
  it("keeps an image shorter than the vertical padding at the padding's height", () => {
    const padding = { top: 48, right: 24, bottom: 48, left: 24 };
    expect(heroGeometry(hero({ aspectRatio: 0.1 }), 600, padding)).toEqual({
      mode: "fixed-height",
      height: 96,
      backgroundWidth: 600,
      backgroundHeight: 60,
    });
  });

  it("keeps a fixed height shorter than the vertical padding at the padding's whole pixels", () => {
    const padding = { top: 40.7, right: 0, bottom: 40.2, left: 0 };
    expect(heroGeometry(hero({ height: 50 }), 600, padding).height).toBe(80);
    expect(heroGeometry(hero({ height: 81 }), 600, padding).height).toBe(81);
  });
});
