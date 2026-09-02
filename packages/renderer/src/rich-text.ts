import { RICH_TEXT_SPACING } from "@templatical/types";

/**
 * Marks the `mj-text` of a block whose content is editor-authored rich text
 * (paragraph and title). MJML puts a `css-class` on the wrapping `<td>`, which
 * is what `richTextStylesheet()` scopes its selectors to.
 *
 * The scope is the point. A bare `p { … }` rule would also reach an `html`
 * block — the renderer puts consumer markup in `mj-text` too — and the editor
 * previews those in a sandboxed `srcdoc` iframe on UA defaults. Styling them
 * would trade this mismatch for another one, and an inlined declaration would
 * beat the consumer's own stylesheet.
 */
export const RICH_TEXT_CSS_CLASS = "tpl-rich-text";

/**
 * The global rule that makes exported rich text match the editor canvas.
 *
 * Two gaps it closes, neither visible until you measure the delivered email:
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
 */
export function richTextStylesheet(): string {
  const s = RICH_TEXT_SPACING;
  const scope = `.${RICH_TEXT_CSS_CLASS}`;

  return [
    `${scope} p { margin: 0 0 ${s.paragraphGap}px; }`,
    `${scope} p:last-child { margin-bottom: 0; }`,
    `${scope} ul, ${scope} ol { margin: ${s.listMarginY}px 0; padding-left: ${s.listPaddingLeft}px; }`,
    `${scope} li { margin: ${s.listItemMarginY}px 0; }`,
  ].join("\n      ");
}
