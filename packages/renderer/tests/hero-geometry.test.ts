import { describe, expect, it } from "vitest";
import type { AppliedHero } from "@templatical/types";
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

describe("heroGeometry", () => {
  it("matches the image with fluid-height, the image drawn at the box width", () => {
    expect(heroGeometry(hero({}), 600)).toEqual({
      mode: "fluid-height",
      backgroundWidth: 600,
      backgroundHeight: 400,
    });
  });

  it("keeps the image's shape in a narrowed box", () => {
    expect(heroGeometry(hero({}), 560)).toEqual({
      mode: "fluid-height",
      backgroundWidth: 560,
      backgroundHeight: 373,
    });
  });

  it("gives a fixed height fixed-height, the image still at its own shape", () => {
    expect(heroGeometry(hero({ height: 300 }), 600)).toEqual({
      mode: "fixed-height",
      height: 300,
      backgroundWidth: 600,
      backgroundHeight: 400,
    });
  });

  it("sizes an unmeasured image to the fixed box", () => {
    expect(
      heroGeometry(hero({ height: 320, aspectRatio: null }), 600),
    ).toEqual({
      mode: "fixed-height",
      height: 320,
      backgroundWidth: 600,
      backgroundHeight: 320,
    });
  });

  it("never emits a zero-sized image", () => {
    expect(
      heroGeometry(hero({ aspectRatio: 0.0001 }), 600).backgroundHeight,
    ).toBe(1);
  });
});
