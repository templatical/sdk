import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { RICH_TEXT_SPACING } from "@templatical/types";

/**
 * The canvas and the exported email must space rich text identically — that is
 * the whole WYSIWYG promise, and issue #616 was it breaking: MJML's skeleton
 * gives every `<p>` a 13px margin while the canvas gave it 8px, so a
 * three-paragraph block was 99px in the editor and 135px in the inbox.
 *
 * `@templatical/renderer` reads `RICH_TEXT_SPACING` directly. CSS cannot import
 * a TS constant, so the canvas side is a literal and this file is the lock that
 * keeps the literal honest.
 *
 * The paragraph gap is settable per block, so its canvas value arrives at
 * runtime through `--tpl-doc-paragraph-spacing` (see `getBlockWrapperStyle`).
 * The literal in the CSS is that variable's *fallback* — the value a surface
 * gets when nothing set the variable, such as a rich-text preview rendered
 * outside a block wrapper — so it still has to equal the constant.
 */

const CSS_PATH = join(__dirname, "../src/styles/index.css");
const css = readFileSync(CSS_PATH, "utf8");

/** The declaration body of the first rule whose selector list contains `selector`. */
function ruleBody(selector: string): string {
  const index = css.indexOf(selector);
  expect(
    index,
    `no rule found for \`${selector}\` — did the selector get renamed?`,
  ).toBeGreaterThan(-1);
  const open = css.indexOf("{", index);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close).trim();
}

describe("canvas rich-text spacing matches the exported email", () => {
  it("spaces paragraphs by the block's gap, falling back to the shared one", () => {
    expect(ruleBody(".tpl-text-content p,")).toContain(
      `margin: 0 0 var(--tpl-doc-paragraph-spacing, ${RICH_TEXT_SPACING.paragraphGap}px)`,
    );
  });

  it("drops the trailing paragraph gap", () => {
    expect(ruleBody(".tpl-text-content p:last-child,")).toContain(
      "margin-bottom: 0",
    );
  });

  it("spaces and indents lists by the shared values", () => {
    const body = ruleBody(".tpl-text-content ul,");

    expect(body).toContain(`margin: ${RICH_TEXT_SPACING.listMarginY}px 0`);
    expect(body).toContain(
      `padding-left: ${RICH_TEXT_SPACING.listPaddingLeft}px`,
    );
  });

  it("spaces list items by the shared gap", () => {
    expect(ruleBody(".tpl-text-content li,")).toContain(
      `margin: ${RICH_TEXT_SPACING.listItemMarginY}px 0`,
    );
  });

  it("states email-content spacing in px, never on the editor's base-size scale", () => {
    // `@apply tpl:mb-2` resolves to `calc(var(--tpl-base-size) / 2)`, and
    // `--tpl-base-size` is consumer-overridable via `--tpl-user-base-size` to
    // scale the editor *chrome*. An email body is a fixed-width document, so
    // spacing derived from that scale drifts from the export whenever a
    // consumer zooms the UI.
    for (const selector of [
      ".tpl-text-content p,",
      ".tpl-text-content ul,",
      ".tpl-text-content li,",
    ]) {
      expect(ruleBody(selector)).not.toContain("@apply");
    }
  });
});

/**
 * Tailwind 4 requires the prefix to lead a variant chain (`tpl:[&_p]:mb-2`).
 * Written the other way round (`[&_p]:tpl:mb-2`) the class is not a utility at
 * all: it emits no CSS and fails silently. Eighteen such classes sat on
 * `ParagraphBlock.vue` and `TitleBlock.vue` and were the first place anyone
 * would go to change paragraph spacing — where changing them does nothing.
 */
describe("arbitrary-variant classes put the tpl prefix first", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.(vue|ts)$/.test(entry) ? [path] : [];
    });
  }

  // Both packages compile Tailwind with the `tpl` prefix, so both can grow the
  // same silent dead class. media-library has none today — this keeps it that
  // way rather than waiting for one to be noticed by its absence.
  it.each([
    ["editor", join(__dirname, "../src")],
    ["media-library", join(__dirname, "../../media-library/src")],
  ])("has no class in %s where a bracket variant precedes the prefix", (
    _package,
    dir,
  ) => {
    const offenders = sourceFiles(dir).flatMap((path) => {
      const matches = readFileSync(path, "utf8").match(/\[&[^\]]*\]:tpl:/g);
      return matches ? [`${path.split("/src/")[1]}: ${matches.join(", ")}`] : [];
    });

    expect(offenders).toEqual([]);
  });
});
