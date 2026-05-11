/**
 * Strip a single outer `<p>` wrapper from a TipTap-stored HTML string so the
 * canvas can render the inner inline content directly inside a heading
 * element. Mirrors the renderer's `unwrapParagraph` so the editor canvas and
 * the exported MJML/HTML agree on the title's element structure.
 */
export function unwrapParagraph(html: string): string {
  const match = html.match(/^\s*<p\b[^>]*>([\s\S]*)<\/p>\s*$/);
  if (!match) return html;
  // Only unwrap when there is exactly one top-level <p>. If the content has
  // multiple paragraphs, leave it alone — same rule the renderer applies.
  if (/<\/p>\s*<p\b/i.test(match[1])) return html;
  return match[1];
}
