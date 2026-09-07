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
 * Resolve a Topol `content` string to a Title or a Paragraph.
 *
 * Topol has no menu or table construct, so this is a two-way choice — the MJML
 * importer needs four arms because `mj-text` is the output of four different
 * block renderers there. Paragraph is the terminal arm and always reachable,
 * so this function is total.
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
 * The visible text of a markup fragment, for a button label — `ButtonBlock.text`
 * is a plain string, so the markup Topol stores in `content` cannot travel.
 */
export function stripTags(html: string | undefined): string {
  if (!html) return "";
  const text = html.replace(/<[^>]*>/g, "");
  const decoded = text.replace(
    /&(?:amp|lt|gt|quot|#39|apos|nbsp);/g,
    (m) => ENTITIES[m] ?? m,
  );
  return decoded.replace(/\s+/g, " ").trim();
}
