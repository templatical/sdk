// Source-level regression for the rich-text floating toolbar's color controls.
// The text-color and highlight controls must use the shared ColorPicker (the
// vanilla-colorful hex wheel used everywhere else in the SDK), NOT the native
// `<input type="color">` (the OS crayon/pencil picker). Mirrors
// paragraphToolbarLinkColor.test.ts: a source assertion rather than mounting the
// full toolbar (which pulls in TipTap + ProseMirror + every formatting child).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../src/components/blocks/ParagraphToolbar.vue"),
  "utf-8",
);

describe("ParagraphToolbar color controls use the shared ColorPicker", () => {
  it("imports and renders the shared ColorPicker, not a native color input", () => {
    expect(SRC).toContain('import ColorPicker from "../ColorPicker.vue";');
    expect(SRC).toContain("<ColorPicker");
    // The native OS picker must never come back — the whole point of the swap.
    expect(SRC).not.toContain('type="color"');
  });

  it("uses the compact 32px swatch to match the toolbar controls", () => {
    // Two swatches (text color + highlight), both sized to the 32px row.
    expect(SRC.match(/size="sm"/g)).toHaveLength(2);
    expect(SRC.match(/swatch-only/g)).toHaveLength(2);
  });

  it("wires text color as unset-aware: raw mark drives the swatch, effective color seeds the wheel", () => {
    expect(SRC).toContain(':model-value="explicitTextColor()"');
    expect(SRC).toContain(':seed-color="effectiveTextColor()"');
    // The clear is the ColorPicker's built-in button; the swatch emits "" ->
    // setColor(""), so no separate reset control remains here.
    expect(SRC).toContain('@update:model-value="setColor"');
  });

  it("explicitTextColor returns the selection's raw color (may be empty), never a resolved default", () => {
    expect(SRC).toContain(
      'return isLinkSelection() ? linkColorAttr() : textStyleAttr("color");',
    );
  });

  it("wires highlight so the yellow default seeds the wheel, not the swatch value", () => {
    expect(SRC).toContain(':model-value="getCurrentHighlight()"');
    expect(SRC).toContain(':seed-color="DEFAULT_HIGHLIGHT_COLOR"');
    expect(SRC).toContain('@update:model-value="setHighlight"');
    // Honors the ColorPicker unset convention: the default belongs in seed-color,
    // never OR-ed into model-value (which would paint a fake "set" swatch).
    expect(SRC).not.toContain(
      "getCurrentHighlight() || DEFAULT_HIGHLIGHT_COLOR",
    );
  });
});
