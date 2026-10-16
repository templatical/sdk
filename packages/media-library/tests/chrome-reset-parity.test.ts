import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The media library's stylesheet carries the editor's chrome reset verbatim:
 * Tailwind's preflight scoped to `:where(.tpl)`, in `@layer base`, excluding
 * `.tpl-email-surface`.
 *
 * Inside the editor, Browse is styled by the editor's CSS and gets the reset
 * from there. Standalone (`init()`, `MediaLibraryModal`) loads only this
 * stylesheet, in the host document, so without its own copy a host with no
 * reset rendered browser defaults: dialog panels overrunning their caps,
 * `<p>` margins inflating grid cards and the footer, buttons in the browser's
 * font and padding.
 *
 * Verbatim, so both surfaces render alike, and so the email-surface exclusion
 * survives: a page can load this stylesheet next to a light-DOM editor, both
 * share `.tpl`, and a copy without it would reset the email canvas. The
 * editor's `tests/chrome-reset-scope.test.ts` pins its copy to preflight, so
 * this one follows preflight too.
 *
 * Reads source, not dist, so it locks the authoring decision directly.
 */

const MEDIA_CSS = readFileSync(
  join(import.meta.dirname, "..", "src", "styles", "index.css"),
  "utf8",
);
const EDITOR_CSS = readFileSync(
  join(import.meta.dirname, "..", "..", "editor", "src", "styles", "index.css"),
  "utf8",
);

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every top-level `@layer base { … }` block, braces matched, comments dropped. */
function baseLayers(css: string): string[] {
  const clean = stripComments(css);
  const blocks: string[] = [];
  const re = /@layer\s+base\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < clean.length && depth > 0; i++) {
      if (clean[i] === "{") depth++;
      else if (clean[i] === "}") depth--;
    }
    blocks.push(clean.slice(m.index, i));
  }
  return blocks;
}

/** Whitespace and quote style differ between the two files; nothing else may. */
const normalize = (css: string) =>
  css
    .replace(/"/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,])\s*/g, "$1")
    .trim();

describe("media-library chrome reset", () => {
  const media = baseLayers(MEDIA_CSS);
  const editor = baseLayers(EDITOR_CSS);

  it("has exactly one `@layer base` block, as the editor does", () => {
    expect(editor).toHaveLength(1);
    expect(media).toHaveLength(1);
  });

  it("is the editor's reset, verbatim", () => {
    // Guard against two empty or truncated blocks comparing equal.
    const reset = normalize(editor[0]);
    expect(reset).toMatch(
      /^@layer base\{:where\(\.tpl\) :where\(\*\):not\(:where\(\.tpl-email-surface,\.tpl-email-surface \*\)\),/,
    );
    expect(reset).toContain(
      "{box-sizing: border-box;margin: 0;padding: 0;border: 0 solid;}",
    );
    expect(reset.match(/\{/g)!.length).toBeGreaterThan(30);

    expect(normalize(media[0])).toBe(reset);
  });

  it("loses to every utility: the utilities stay unlayered", () => {
    // An unlayered rule beats any layer, whatever its specificity. Layering
    // the utilities would let the reset's `margin: 0` / `padding: 0` beat
    // `tpl:mb-2`, `tpl:p-5` and the rest wherever the utility's layer sorts
    // first.
    const utilities = stripComments(MEDIA_CSS).match(
      /@import\s+["']tailwindcss\/utilities\.css["'][^;]*;/,
    );
    expect(utilities).not.toBeNull();
    expect(utilities![0]).not.toMatch(/\blayer\b/);
  });
});
