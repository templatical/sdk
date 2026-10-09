import { describe, expect, it } from "vitest";
import {
  SOCIAL_ICON_TONES,
  SOCIAL_ICON_GLYPHS,
  SOCIAL_ICON_STYLES,
  SOCIAL_ICON_TONE_COLORS,
  socialIconAssetDir,
  socialIconColors,
  socialIconGlyphScale,
} from "../src/social";
import type { SocialIconTone } from "../src/blocks";

const EXPECTED_PLATFORMS = [
  "facebook",
  "twitter",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "email",
  "whatsapp",
  "telegram",
  "discord",
  "snapchat",
  "reddit",
  "github",
  "dribbble",
  "behance",
  "website",
];

describe("SOCIAL_ICON_GLYPHS", () => {
  it("covers exactly the 17 supported platforms", () => {
    expect(Object.keys(SOCIAL_ICON_GLYPHS).sort()).toEqual(
      [...EXPECTED_PLATFORMS].sort(),
    );
  });

  it("each glyph is exactly { color, path } with a 6-digit hex and a real path", () => {
    for (const platform of EXPECTED_PLATFORMS) {
      const glyph =
        SOCIAL_ICON_GLYPHS[platform as keyof typeof SOCIAL_ICON_GLYPHS];
      expect(Object.keys(glyph).sort()).toEqual(["color", "path"]);
      expect(glyph.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(glyph.path.length).toBeGreaterThan(10);
    }
  });

  it("pins known brand colors (regression guard against accidental edits)", () => {
    expect(SOCIAL_ICON_GLYPHS.facebook.color).toBe("#1877F2");
    expect(SOCIAL_ICON_GLYPHS.youtube.color).toBe("#FF0000");
    // website + email share the neutral grey so the globe doesn't read heavy.
    expect(SOCIAL_ICON_GLYPHS.website.color).toBe("#6B7280");
    expect(SOCIAL_ICON_GLYPHS.email.color).toBe("#6B7280");
  });

  it("website glyph path is the globe outline", () => {
    expect(SOCIAL_ICON_GLYPHS.website.path.startsWith("M21.721")).toBe(true);
  });
});

describe("socialIconColors", () => {
  it("draws a brand icon in the platform's color with a white glyph", () => {
    expect(socialIconColors("facebook", "brand")).toEqual({
      fill: SOCIAL_ICON_GLYPHS.facebook.color,
      onFill: "#ffffff",
    });
    expect(socialIconColors("facebook", undefined)).toEqual(
      socialIconColors("facebook", "brand"),
    );
  });

  it("draws a tone the same for every platform", () => {
    expect(socialIconColors("facebook", "dark")).toEqual({
      fill: SOCIAL_ICON_TONE_COLORS.dark,
      onFill: "#ffffff",
    });
    expect(socialIconColors("youtube", "dark")).toEqual({
      fill: SOCIAL_ICON_TONE_COLORS.dark,
      onFill: "#ffffff",
    });
  });

  it("puts a near-black glyph on a light badge, where white would vanish", () => {
    expect(socialIconColors("github", "light")).toEqual({
      fill: "#ffffff",
      onFill: SOCIAL_ICON_TONE_COLORS.dark,
    });
  });

  it("falls back to the brand color for an unknown value", () => {
    // Names every object inherits must not pass for a tone either.
    for (const tampered of ["neon", "constructor", "__proto__", "toString"]) {
      expect(socialIconColors("github", tampered as SocialIconTone)).toEqual(
        socialIconColors("github", "brand"),
      );
    }
  });
});

describe("socialIconAssetDir", () => {
  it("keeps brand icons in the style's folder, as before", () => {
    for (const style of SOCIAL_ICON_STYLES) {
      expect(socialIconAssetDir(style, "brand")).toBe(style);
      expect(socialIconAssetDir(style, undefined)).toBe(style);
    }
  });

  it("names a folder per style and tone", () => {
    const dirs = SOCIAL_ICON_STYLES.flatMap((style) =>
      SOCIAL_ICON_TONES.map((color) => socialIconAssetDir(style, color)),
    );
    expect(new Set(dirs).size).toBe(
      SOCIAL_ICON_STYLES.length * SOCIAL_ICON_TONES.length,
    );
    expect(socialIconAssetDir("circle", "dark")).toBe("circle-dark");
    expect(socialIconAssetDir("plain", "light")).toBe("plain-light");
    for (const tampered of ["neon", "constructor", "__proto__", "toString"]) {
      expect(socialIconAssetDir("circle", tampered as SocialIconTone)).toBe(
        "circle",
      );
    }
  });
});

describe("socialIconGlyphScale", () => {
  it("draws a plain glyph larger than one inside a badge or outline", () => {
    expect(socialIconGlyphScale("plain")).toBe(0.84);
    for (const style of SOCIAL_ICON_STYLES.filter((s) => s !== "plain")) {
      expect(socialIconGlyphScale(style)).toBe(0.6);
    }
  });
});
