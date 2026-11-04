import { findOpenTagEnd } from "@templatical/types";

/**
 * Strip a single outer `<p>` wrapper from a TipTap-stored HTML string so the
 * canvas can render the inner inline content directly inside a heading
 * element. Mirrors the renderer's `unwrapParagraph` so the editor canvas and
 * the exported MJML/HTML agree on the title's element structure.
 */
export function unwrapParagraph(html: string): string {
  const openingTag = /^\s*<p\b/.exec(html);
  if (!openingTag) return html;
  const openingTagEnd = findOpenTagEnd(html, openingTag[0].length);
  if (openingTagEnd === -1) return html;
  const closingTag = /<\/p>\s*$/.exec(html);
  if (!closingTag || closingTag.index <= openingTagEnd) return html;
  const content = html.slice(openingTagEnd + 1, closingTag.index);
  // Only unwrap when there is exactly one top-level <p>. If the content has
  // multiple paragraphs, leave it alone — same rule the renderer applies.
  if (/<\/p>\s*<p\b/i.test(content)) return html;
  return content;
}
