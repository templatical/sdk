// Source-level regression for ParagraphToolbar.setColor. When the selection is
// a link, setting a color must ALSO strip any inner text-color mark so the
// `<a>` color alone drives both the text and the underline (per-link color,
// absolute priority — matching the link dialog). Mirrors
// paragraphToolbarMergeTag.test.ts: a source assertion rather than mounting the
// full toolbar (which pulls in TipTap + ProseMirror + every formatting child).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../src/components/blocks/ParagraphToolbar.vue"),
  "utf-8",
);

describe("ParagraphToolbar.setColor — per-link color strips inner text color", () => {
  it("recolors the whole link via updateAttributes on the extended range", () => {
    expect(SRC).toContain('.extendMarkRange("link").updateAttributes("link", {');
    expect(SRC).toContain("color: color || null,");
  });

  it("strips the inner text color, but only when a color is being set", () => {
    // Distinct from the non-link `else` branch (`chain.unsetColor().run()`):
    // the strip is guarded by `if (color)` so clearing a link color leaves the
    // text color untouched.
    expect(SRC).toContain("if (color) chain.unsetColor();");
  });

  it("unifies a link with a text color applied over it (mixed selection)", () => {
    // The reverse direction: setting a text color across a selection that
    // includes a link must also update the link's own color, so the <a>
    // (underline + the color the dialog/toolbar read) matches the recolored
    // glyphs instead of leaving a red underline under blue text.
    expect(SRC).toContain(
      'chain.setColor(color).updateAttributes("link", { color }).run();',
    );
  });
});
