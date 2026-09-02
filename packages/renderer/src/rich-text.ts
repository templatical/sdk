import { RICH_TEXT_SPACING, isSection } from "@templatical/types";
import type { Block } from "@templatical/types";

/**
 * Marks the `mj-text` of a block whose content is editor-authored rich text
 * (paragraph and title). MJML puts a `css-class` on the wrapping `<td>`, which
 * is what {@link richTextStylesheet} scopes its selectors to.
 *
 * The scope is the point. A bare `p { … }` rule would also reach an `html`
 * block — the renderer puts consumer markup in `mj-text` too — and the editor
 * previews those in a sandboxed `srcdoc` iframe on UA defaults. Styling them
 * would trade this mismatch for another one, and an inlined declaration would
 * beat the consumer's own stylesheet.
 */
export const RICH_TEXT_CSS_CLASS = "tpl-rich-text";

/**
 * The class carrying one specific paragraph gap, e.g. `tpl-rich-text-8`.
 *
 * Every rich-text block gets one of these *instead of* a shared paragraph rule.
 * That is a hard constraint, not a preference: `.tpl-rich-text p` and
 * `.tpl-rich-text-4 p` have identical specificity (one class, one type), so a
 * surviving base rule would win on source order and flatten every per-block gap
 * back to the default.
 */
export function richTextGapClass(gap: number): string {
  return `${RICH_TEXT_CSS_CLASS}-${gap}`;
}

/**
 * The global rules that make exported rich text match the editor canvas.
 *
 * Two gaps they close, neither visible until you measure the delivered email:
 *
 * - MJML's core skeleton injects `p { display:block;margin:13px 0; }` into
 *   every document. Against the canvas's paragraph gap that made a
 *   three-paragraph block 99px in the editor and 135px in the inbox — 13px
 *   above the first paragraph, 13px below the last, and 13px rather than 8px
 *   between each (issue #616).
 * - The skeleton resets nothing for `ul` / `ol` / `li`, so those fall through
 *   to each client's UA stylesheet — around 14px margin and a 40px bullet
 *   indent in Chromium, against the canvas's 8px and 24px. Unlike the
 *   paragraph case the value is not even a fixed constant, so matching MJML in
 *   the editor could not have fixed it.
 *
 * Emitted inside `<mj-style inline="inline">`, so MJML runs it through juice
 * and the declarations land as real inline styles. That matters twice: they
 * survive a client that strips `<style>` from the head, and juice resolves
 * `:last-child` structurally at build time instead of dropping it.
 *
 * One paragraph rule per *distinct* gap in the document, so a template using
 * two gaps costs two rules rather than one per block. The list values stay on
 * the unversioned class: MJML resets nothing for `ul`/`ol`/`li`, so they exist
 * to pin down client defaults rather than to be designed with.
 */
export function richTextStylesheet(gaps: number[]): string {
  const s = RICH_TEXT_SPACING;
  const scope = `.${RICH_TEXT_CSS_CLASS}`;
  const distinct = [...new Set(gaps)].sort((a, b) => a - b);

  const paragraphRules = distinct.flatMap((gap) => {
    const gapScope = `.${richTextGapClass(gap)}`;
    return [
      `${gapScope} p { margin: 0 0 ${gap}px; }`,
      `${gapScope} p:last-child { margin-bottom: 0; }`,
    ];
  });

  return [
    ...paragraphRules,
    `${scope} ul, ${scope} ol { margin: ${s.listMarginY}px 0; padding-left: ${s.listPaddingLeft}px; }`,
    `${scope} li { margin: ${s.listItemMarginY}px 0; }`,
  ].join("\n      ");
}

/**
 * The paragraph gap a block asks for, or the built-in default.
 *
 * The fallback must produce a *rule* rather than nothing: silence hands the
 * paragraph back to MJML's `p { margin: 13px 0 }` skeleton default and reopens
 * the canvas/export mismatch. `0` is a legitimate gap, so this tests for
 * absence rather than falsiness.
 *
 * Mirrored on the canvas side by `getBlockWrapperStyle` in
 * `@templatical/editor`.
 */
export function resolveParagraphGap(spacing: number | undefined): number {
  return spacing ?? RICH_TEXT_SPACING.paragraphGap;
}

/**
 * Every paragraph gap the document uses, so the head can carry a rule for each.
 *
 * Walks sections' children too — a paragraph inside a column needs its rule as
 * much as a top-level one. Titles always use the default gap: their content is
 * normally a single paragraph the renderer unwraps, and the multi-paragraph
 * case is an edge worth spacing consistently rather than configuring.
 */
export function collectParagraphGaps(blocks: Block[]): number[] {
  const gaps: number[] = [RICH_TEXT_SPACING.paragraphGap];

  const visit = (block: Block): void => {
    if (block.type === "paragraph") {
      gaps.push(resolveParagraphGap(block.paragraphSpacing));
    }
    if (isSection(block)) {
      for (const column of block.children) {
        for (const child of column) {
          visit(child);
        }
      }
    }
  };

  for (const block of blocks) {
    visit(block);
  }

  return gaps;
}
