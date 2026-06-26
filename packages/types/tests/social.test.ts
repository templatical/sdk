import { describe, expect, it } from "vitest";
import { SOCIAL_ICON_GLYPHS } from "../src/social";

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
      const glyph = SOCIAL_ICON_GLYPHS[platform as keyof typeof SOCIAL_ICON_GLYPHS];
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
