import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getBlockTypeLabel } from "../src/utils/blockTypeLabels";
import type { Translations } from "../src/i18n";

const mockTranslations = {
  blocks: {
    section: "Section",
    image: "Image",
    title: "Title",
    paragraph: "Paragraph",
    button: "Button",
    divider: "Divider",
    video: "Video",
    social: "Social",
    menu: "Menu",
    table: "Table",
    spacer: "Spacer",
    countdown: "Countdown",
    html: "HTML",
  },
} as unknown as Translations;

describe("getBlockTypeLabel", () => {
  it("returns the translated label for known block types", () => {
    expect(getBlockTypeLabel("section", mockTranslations)).toBe("Section");
    expect(getBlockTypeLabel("image", mockTranslations)).toBe("Image");
    expect(getBlockTypeLabel("html", mockTranslations)).toBe("HTML");
    expect(getBlockTypeLabel("countdown", mockTranslations)).toBe("Countdown");
    expect(getBlockTypeLabel("video", mockTranslations)).toBe("Video");
  });

  it("falls back to the raw type string for unknown block types", () => {
    expect(getBlockTypeLabel("unknown", mockTranslations)).toBe("unknown");
    expect(getBlockTypeLabel("custom", mockTranslations)).toBe("custom");
  });

  it("covers all 13 built-in block types with correct translations", () => {
    const expectedLabels: Record<string, string> = {
      section: "Section",
      image: "Image",
      title: "Title",
      paragraph: "Paragraph",
      button: "Button",
      divider: "Divider",
      video: "Video",
      social: "Social",
      menu: "Menu",
      table: "Table",
      spacer: "Spacer",
      countdown: "Countdown",
      html: "HTML",
    };
    for (const [type, expected] of Object.entries(expectedLabels)) {
      expect(getBlockTypeLabel(type, mockTranslations)).toBe(expected);
    }
  });
});

describe("getBlockTypeLabel is used by Toolbar.vue and Sidebar.vue", () => {
  function readSrc(relativePath: string): string {
    return readFileSync(
      resolve(__dirname, "..", "src", relativePath),
      "utf-8",
    );
  }

  it("Toolbar.vue imports and uses getBlockTypeLabel", () => {
    const src = readSrc("components/Toolbar.vue");
    expect(src).toContain(
      'import { getBlockTypeLabel } from "../utils/blockTypeLabels"',
    );
    expect(src).toContain("getBlockTypeLabel(blockType.value, t)");
    // Should NOT have an inline labels record
    expect(src).not.toMatch(/const labels:\s*Record<string,\s*string>/);
  });

  it("Sidebar.vue imports and uses getBlockTypeLabel", () => {
    const src = readSrc("components/Sidebar.vue");
    expect(src).toContain(
      'import { getBlockTypeLabel } from "../utils/blockTypeLabels"',
    );
    expect(src).toContain("getBlockTypeLabel(");
    // Should NOT have inline t.blocks.* mappings in the block type array
    expect(src).not.toContain("label: t.blocks.section");
    expect(src).not.toContain("label: t.blocks.image");
  });
});
