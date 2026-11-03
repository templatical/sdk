import { RICH_TEXT_SPACING, isSection, isWrapper } from "@templatical/types";
import type { Block, ContentDirection } from "@templatical/types";

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
export function richTextStylesheet(
  gaps: number[],
  direction: ContentDirection = "ltr",
): string {
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

  // Physical sides: Outlook does not honour `padding-inline-start`.
  const listPaddingSide =
    direction === "rtl" ? "padding-right" : "padding-left";

  return [
    ...paragraphRules,
    `${scope} ul, ${scope} ol { margin: ${s.listMarginY}px 0; ${listPaddingSide}: ${s.listPaddingLeft}px; }`,
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
 * Walks section columns and wrapper children too — a paragraph inside a column
 * or a layout card needs its rule as much as a top-level one. Titles always
 * use the default gap: their content is normally a single paragraph the
 * renderer unwraps, and the multi-paragraph case is an edge worth spacing
 * consistently rather than configuring.
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
    } else if (isWrapper(block)) {
      for (const child of block.children) {
        visit(child);
      }
    }
  };

  for (const block of blocks) {
    visit(block);
  }

  return gaps;
}

/**
 * The named references {@link decodeStyleReferences} writes out. `<` and `>`
 * stay encoded, named or numeric: MJML parses its source as XML, which forbids
 * a raw `<` in an attribute, and no CSS value needs one.
 */
const NAMED_STYLE_REFERENCES: Record<string, string> = {
  apos: "'",
  quot: '"',
  nbsp: String.fromCharCode(0xa0),
};

const STYLE_REFERENCE = /&(?:#(\d+)|#x([0-9a-f]+)|(apos|quot|nbsp));/gi;
const OPENING_TAG = /<[a-z][^<>]*>/gi;
const STYLE_ATTRIBUTE = /(\sstyle\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi;

function decodeStyleReference(
  reference: string,
  quote: string,
  decimal: string | undefined,
  hex: string | undefined,
  name: string | undefined,
): string {
  let char: string;
  if (name !== undefined) {
    char = NAMED_STYLE_REFERENCES[name.toLowerCase()];
  } else {
    const codePoint =
      decimal !== undefined ? Number(decimal) : parseInt(hex ?? "", 16);
    const valid =
      codePoint > 0 &&
      codePoint <= 0x10ffff &&
      !(codePoint >= 0xd800 && codePoint <= 0xdfff);
    if (!valid) return reference;
    char = String.fromCodePoint(codePoint);
  }
  // A raw `&` could start a reference, and the delimiter would end the
  // attribute; CSS reads either quote the same.
  if (char === "&") return "&amp;";
  if (char === "<" || char === ">") return reference;
  if (char === quote) return quote === '"' ? "'" : '"';
  return char;
}

/**
 * Rich-text HTML with the character references in its `style` attributes
 * written as the characters they stand for (`&apos;` → `'`), `&amp;`, `&lt;`
 * and `&gt;` aside.
 *
 * MJML inlines {@link richTextStylesheet} with juice, which re-parses the
 * style attribute of every element a rule matches and splits it on `;`
 * without decoding references first. The `;` that ends `&apos;`, `&quot;` or
 * `&nbsp;` outside a `url()` therefore cuts a declaration in two, and the
 * compile throws. Imported content carries such references: BeeFree's TinyMCE
 * output and import-mjml's serializer write them.
 */
export function decodeStyleReferences(html: string): string {
  if (!html.includes("&")) return html;
  return html.replace(OPENING_TAG, (tag) =>
    tag.replace(
      STYLE_ATTRIBUTE,
      (
        _attribute,
        prefix: string,
        doubleQuoted: string | undefined,
        singleQuoted: string | undefined,
      ) => {
        const quote = doubleQuoted !== undefined ? '"' : "'";
        const value = (doubleQuoted ?? singleQuoted ?? "").replace(
          STYLE_REFERENCE,
          (reference, decimal, hex, name) =>
            decodeStyleReference(reference, quote, decimal, hex, name),
        );
        return `${prefix}${quote}${value}${quote}`;
      },
    ),
  );
}
