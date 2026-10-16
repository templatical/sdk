import { describe, expect, it } from "vitest";
import {
  createBackgroundImage,
  createSectionBlock,
  heroBoxWidth,
  imageAspectRatio,
  resolveHero,
} from "../src";
import type { BackgroundImage, SectionHero } from "../src";

const URL = "https://cdn.test/hero.jpg";
const MEASURED: BackgroundImage = {
  ...createBackgroundImage(URL),
  width: 1200,
  height: 800,
};
const MATCH: SectionHero = { height: "image", verticalAlign: "middle" };

describe("resolveHero", () => {
  it("is null for a section without hero", () => {
    expect(
      resolveHero(createSectionBlock({ backgroundImage: MEASURED })),
    ).toBeNull();
  });

  it("is null when hero is not an object (tampered JSON)", () => {
    const section = createSectionBlock({ backgroundImage: MEASURED });
    (section as unknown as { hero: unknown }).hero = true;
    expect(resolveHero(section)).toBeNull();
  });

  it("applies a hero that matches a measured image", () => {
    expect(
      resolveHero(createSectionBlock({ backgroundImage: MEASURED, hero: MATCH })),
    ).toEqual({
      applied: true,
      image: {
        url: URL,
        size: "cover",
        position: "center center",
        repeat: "no-repeat",
      },
      height: "image",
      verticalAlign: "middle",
      aspectRatio: 800 / 1200,
    });
  });

  it("applies a fixed height without a measured image", () => {
    const hero = resolveHero(
      createSectionBlock({
        backgroundImage: createBackgroundImage(URL),
        hero: { height: 320, verticalAlign: "bottom" },
      }),
    );
    expect(hero).toMatchObject({
      applied: true,
      height: 320,
      verticalAlign: "bottom",
      aspectRatio: null,
    });
  });

  it("rounds a fractional fixed height", () => {
    const hero = resolveHero(
      createSectionBlock({
        backgroundImage: MEASURED,
        hero: { height: 320.6, verticalAlign: "top" },
      }),
    );
    expect(hero).toMatchObject({ applied: true, height: 321 });
  });

  it("does not apply with more than one column", () => {
    expect(
      resolveHero(
        createSectionBlock({
          columns: "2",
          children: [[], []],
          backgroundImage: MEASURED,
          hero: MATCH,
        }),
      ),
    ).toEqual({ applied: false, reason: "columns" });
  });

  it("reports columns before a missing image", () => {
    expect(
      resolveHero(
        createSectionBlock({ columns: "1-2", children: [[], []], hero: MATCH }),
      ),
    ).toEqual({ applied: false, reason: "columns" });
  });

  it.each([undefined, { ...MEASURED, url: "   " }])(
    "does not apply without a usable image (%j)",
    (backgroundImage) => {
      expect(
        resolveHero(createSectionBlock({ backgroundImage, hero: MATCH })),
      ).toEqual({ applied: false, reason: "image" });
    },
  );

  it.each([
    { width: undefined, height: undefined },
    { width: 0, height: 800 },
    { width: 1200, height: Number.NaN },
    { width: Number.POSITIVE_INFINITY, height: 800 },
  ])("does not match an image whose size is unknown (%j)", (size) => {
    expect(
      resolveHero(
        createSectionBlock({
          backgroundImage: { ...createBackgroundImage(URL), ...size },
          hero: MATCH,
        }),
      ),
    ).toEqual({ applied: false, reason: "size" });
  });

  it.each([-5, 0, 0.4, "300"])(
    "reads a height that isn't a positive number (%j) as matching the image",
    (height) => {
      const hero = resolveHero(
        createSectionBlock({
          backgroundImage: MEASURED,
          hero: { height, verticalAlign: "top" } as unknown as SectionHero,
        }),
      );
      expect(hero).toMatchObject({ applied: true, height: "image" });
    },
  );

  it("falls back to middle for an unknown verticalAlign", () => {
    const hero = resolveHero(
      createSectionBlock({
        backgroundImage: MEASURED,
        hero: { height: "image", verticalAlign: "sideways" } as unknown as SectionHero,
      }),
    );
    expect(hero).toMatchObject({ applied: true, verticalAlign: "middle" });
  });
});

describe("imageAspectRatio", () => {
  it("is height over width", () => {
    expect(imageAspectRatio(MEASURED)).toBe(800 / 1200);
  });

  it.each([
    undefined,
    createBackgroundImage(URL),
    { ...MEASURED, width: 0 },
    { ...MEASURED, height: -1 },
    { ...MEASURED, height: Number.NaN },
  ])("is null without a positive, finite size (%j)", (bg) => {
    expect(imageAspectRatio(bg)).toBeNull();
  });
});

describe("heroBoxWidth", () => {
  const band = (left: number, right: number) => ({
    top: 10,
    right,
    bottom: 10,
    left,
  });

  it("is the content width with no band", () => {
    expect(heroBoxWidth(600)).toBe(600);
  });

  it("subtracts each band's left and right padding", () => {
    expect(heroBoxWidth(600, [band(20, 20)])).toBe(560);
    expect(heroBoxWidth(600, [band(20, 20), band(10, 30)])).toBe(520);
  });

  it("ignores a band without padding", () => {
    expect(heroBoxWidth(600, [undefined, band(0, 40)])).toBe(560);
  });

  it("never drops below 1px", () => {
    expect(heroBoxWidth(100, [band(80, 80)])).toBe(1);
  });
});
