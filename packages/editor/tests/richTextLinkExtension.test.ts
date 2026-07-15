import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Rich-text link extension config invariant (issue #351).
 *
 * StarterKit (>= 3) bundles `@tiptap/extension-link` and registers it with the
 * default `openOnClick: true`. Both rich-text editors also add their own
 * `LinkExt` configured with `openOnClick: false` + target/rel attributes. If
 * StarterKit's bundled link is NOT disabled, `link` is registered twice — the
 * duplicate carries `openOnClick: true`, so clicking a link *while editing*
 * opens its href in a new tab (and TipTap logs a duplicate-extension warning).
 *
 * The fix disables StarterKit's copy via `link: false`, leaving the explicit
 * `LinkExt` (openOnClick: false) as the only link extension. This is asserted
 * against source because the real extension config in these `.vue` files is
 * never exercised with real TipTap — useRichTextEditor.test.ts uses stubs — so
 * a source-read is the regression guard. Remove `link: false` and this fails.
 */

const SRC = join(import.meta.dirname, "..", "src");

function read(relPath: string): string {
  return readFileSync(join(SRC, relPath), "utf8");
}

const EDITORS = [
  "components/blocks/ParagraphEditor.vue",
  "components/blocks/TitleEditor.vue",
];

describe("rich-text link extension config", () => {
  for (const relPath of EDITORS) {
    const source = read(relPath);

    it(`${relPath}: disables StarterKit's bundled link extension`, () => {
      expect(source).toMatch(/StarterKit\.configure\(/);
      expect(source).toMatch(/link:\s*false/);
    });

    it(`${relPath}: adds a LinkExt with openOnClick disabled`, () => {
      expect(source).toMatch(/LinkExt\.configure\(/);
      expect(source).toMatch(/openOnClick:\s*false/);
    });
  }

  // ParagraphEditor is the only rich-text editor that adds its own
  // UnderlineExt, so it's the only one that also duplicates StarterKit's
  // bundled `underline`. Disable StarterKit's copy (keeping the explicit one)
  // so `underline` isn't registered twice. TitleEditor doesn't add UnderlineExt
  // and therefore needs no `underline: false`.
  it("ParagraphEditor.vue: disables StarterKit's underline but keeps the explicit UnderlineExt", () => {
    const source = read("components/blocks/ParagraphEditor.vue");
    expect(source).toMatch(/underline:\s*false/);
    expect(source).toContain("UnderlineExt");
  });
});
