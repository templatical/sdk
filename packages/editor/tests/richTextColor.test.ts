import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveEffectiveTextColor } from "../src/utils/richTextColor";

/**
 * Paragraph text-color control (issue #373). The swatch must show the color the
 * selection actually renders in — an explicit inline mark, else the inherited
 * document `textColor` — instead of the old hard-coded `#000000`, and expose a
 * reset only when an explicit override exists.
 *
 * ParagraphToolbar is asserted at the source level (mounting it boots TipTap +
 * every formatting child); the resolution logic is unit-tested directly.
 */

const SRC = readFileSync(
  resolve(__dirname, "../src/components/blocks/ParagraphToolbar.vue"),
  "utf-8",
);

describe("resolveEffectiveTextColor", () => {
  it("prefers an explicit inline color over the document color", () => {
    expect(resolveEffectiveTextColor("#ff0000", "#1a1a1a")).toBe("#ff0000");
  });

  it("falls back to the document text color when no inline mark is set", () => {
    expect(resolveEffectiveTextColor("", "#1a1a1a")).toBe("#1a1a1a");
  });

  it("falls back to the built-in default when neither is set (legacy content)", () => {
    expect(resolveEffectiveTextColor("", undefined)).toBe("#000000");
  });

  it("uses the explicit color even when the document color is unset", () => {
    expect(resolveEffectiveTextColor("#abcdef", undefined)).toBe("#abcdef");
  });
});

describe("ParagraphToolbar text-color wiring (issue #373)", () => {
  it("binds the swatch to the resolved effective color, not a hard-coded default", () => {
    expect(SRC).toContain(':value="effectiveTextColor()"');
    // The old always-black fallback must be gone.
    expect(SRC).not.toContain("textStyleAttr('color') || DEFAULT_TEXT_COLOR");
  });

  it("resolves the effective color from the inline mark and the document textColor", () => {
    expect(SRC).toContain("resolveEffectiveTextColor(");
    expect(SRC).toContain("editorReturn?.content.value.settings");
    expect(SRC).toContain("settings?.textColor");
  });

  it("shows a reset control only when an explicit inline color exists", () => {
    expect(SRC).toContain('v-if="hasExplicitTextColor()"');
    expect(SRC).toMatch(/@click="setColor\(''\)"/);
  });
});

describe("ParagraphToolbar color control is link-aware (per-link color, #373)", () => {
  it("colors the link itself (not a text span) when the selection is a link", () => {
    expect(SRC).toContain("isLinkSelection()");
    // The <a> is recolored via its own attribute so text + underline stay in
    // sync; the whole link is extended so it doesn't split into segments.
    // (`\s*` tolerates the object wrapping onto its own line — see the
    // absolute-priority strip covered in paragraphToolbarLinkColor.test.ts.)
    expect(SRC).toMatch(/updateAttributes\("link", \{\s*color:/);
    expect(SRC).toContain('extendMarkRange("link")');
  });

  it("reads the link's own color for the effective swatch and reset gate", () => {
    expect(SRC).toContain("linkColorAttr()");
  });
});
