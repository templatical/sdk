import { describe, expect, it } from "vitest";
import {
  createBackgroundImage,
  createSectionBlock,
  imageAspectRatio,
  resolveHero,
} from "../src";
import type { BackgroundImage, SectionHero } from "../src";

const URL = "https://cdn.test/hero.jpg";
const MEASURED: BackgroundImage = {
  ...createBackgroundImage(URL),
  naturalWidth: 1200,
  naturalHeight: 800,
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
    { naturalWidth: undefined, naturalHeight: undefined },
    { naturalWidth: 0, naturalHeight: 800 },
    { naturalWidth: 1200, naturalHeight: Number.NaN },
    { naturalWidth: Number.POSITIVE_INFINITY, naturalHeight: 800 },
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
    "reads a height that isn't a number of at least 1 (%j) as matching the image",
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
    { ...MEASURED, naturalWidth: 0 },
    { ...MEASURED, naturalHeight: -1 },
    { ...MEASURED, naturalHeight: Number.NaN },
  ])("is null without a positive, finite size (%j)", (bg) => {
    expect(imageAspectRatio(bg)).toBeNull();
  });
});
