import { findOpenTagEnd } from "@templatical/types";
import type { HeadingLevel } from "@templatical/types";

export type InferredText =
  | { kind: "title"; level: HeadingLevel; inner: string; clampedFrom?: number }
  | { kind: "paragraph"; html: string };

/**
 * A single heading element wrapping the whole content, captured with its level
 * and inner markup. Anchored at both ends so a heading with a sibling does not
 * match — that case is a paragraph.
 */
const SOLE_HEADING = /^<h([1-6])(?:\s[^>]*)?>([\s\S]*)<\/h\1>$/i;

const BLOCK_ROOT = /^<(p|h[1-6]|ul|ol|blockquote|div|table)\b/i;

/**
 * Resolve a Chamaileon `attrs.text` string to a Title or a Paragraph.
 *
 * Chamaileon has no menu or table construct for this arm, so this is a two-way
 * choice — the MJML importer needs four arms because `mj-text` is the output
 * of four different block renderers there. Paragraph is the terminal arm and
 * always reachable, so this function is total.
 */
export function inferTextBlock(content: string | undefined): InferredText {
  const trimmed = (content ?? "").trim();
  if (trimmed === "") return { kind: "paragraph", html: "<p></p>" };

  const heading = trimmed.match(SOLE_HEADING);
  if (heading) {
    const source = Number(heading[1]);
    const level = Math.min(source, 4) as HeadingLevel;
    return {
      kind: "title",
      level,
      inner: heading[2].trim(),
      ...(source > 4 ? { clampedFrom: source } : {}),
    };
  }

  return {
    kind: "paragraph",
    html: BLOCK_ROOT.test(trimmed) ? trimmed : `<p>${trimmed}</p>`,
  };
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Remove every `<tag>` from `html`, keeping the text between them.
 *
 * A single-pass linear scan rather than `/<[^>]*>/g`: that regex is
 * polynomial over input with many `<` starts and no closing `>`, since
 * `[^>]*` backtracks at every one of them — `"<".repeat(n)` is quadratic in
 * `n`. `findOpenTagEnd` (from `@templatical/types`) resolves each `<` with a
 * bounded, quote-aware forward scan instead, so the walk stays O(n): every
 * character is visited at most once by `indexOf` and once by
 * `findOpenTagEnd`, because the cursor only moves forward and an
 * unterminated tag ends the walk rather than retrying from inside it. On
 * that unterminated case the remainder of the string — the dangling `<`
 * included — is emitted as-is, matching what `/<[^>]*>/g` does with
 * malformed markup: it can never complete a match without a `>`, so the
 * text is left untouched from that point on.
 */
function removeTags(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf("<", i);
    if (open === -1) {
      out += html.substring(i);
      break;
    }
    out += html.substring(i, open);
    const tagEnd = findOpenTagEnd(html, open + 1);
    if (tagEnd === -1) {
      out += html.substring(open);
      break;
    }
    i = tagEnd + 1;
  }
  return out;
}

/**
 * The visible text of a markup fragment, for a button label — `ButtonBlock.text`
 * is a plain string, so the markup Chamaileon stores in `attrs.text` cannot
 * travel.
 */
export function stripTags(html: string | undefined): string {
  if (!html) return "";
  const text = removeTags(html);
  const decoded = text.replace(
    /&(?:amp|lt|gt|quot|#39|apos|nbsp);/g,
    (m) => ENTITIES[m] ?? m,
  );
  return decoded.replace(/\s+/g, " ").trim();
}
