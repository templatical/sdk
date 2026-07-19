import type { Mark } from "@tiptap/core";
import { normalizeColorToHex } from "./color";

/**
 * Restrict a per-link color to safe CSS color forms — hex, `rgb()/rgba()`,
 * `hsl()/hsla()`, or a bare keyword. Anything containing characters that could
 * break out of the `style="color: …"` attribute in the exported HTML (`;`,
 * `{`, `}`, quotes, `url(`) is rejected and returns `null`, so no color is
 * emitted rather than an attacker-controlled declaration. The renderer passes
 * link content through verbatim, so this is the sanitization boundary for the
 * exported email as well as the canvas.
 */
export function sanitizeLinkColor(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (/^(rgb|rgba|hsl|hsla)\(\s*[0-9.,%/\s]+\)$/i.test(v)) return v;
  if (/^[a-z]+$/i.test(v)) return v;
  return null;
}

/**
 * Extend the TipTap Link mark with a `color` attribute so a link's color lives
 * on the `<a>` itself (rendered as inline `style="color: …"`), not a separate
 * inner text-color span.
 *
 * Why: a text-color mark only colors the inner text, while the underline is
 * painted by the ancestor `<a>` in the document link color — so an overridden
 * link showed mismatched text and underline (and the same mismatch shipped in
 * the exported MJML/HTML). With the color on the `<a>`, the underline follows
 * `currentColor`, so text and underline stay in sync in the canvas and the
 * exported email. Inline color also beats the global `a { color }` rule on both
 * surfaces, so a per-link color overrides the document link color. (Per-link
 * color, deferred from #352.)
 *
 * The base `LinkExt` is passed in (rather than imported) so this helper carries
 * no static `@tiptap` dependency and rides the editor's lazy-loaded chunk.
 */
export function withLinkColor(LinkExt: Mark): Mark {
  return LinkExt.extend({
    addAttributes() {
      return {
        // Preserve href/target/rel and any other base Link attributes.
        ...this.parent?.(),
        color: {
          default: null,
          parseHTML: (element: HTMLElement) =>
            sanitizeLinkColor(normalizeColorToHex(element.style.color)),
          renderHTML: (attributes: Record<string, unknown>) => {
            const color = sanitizeLinkColor(attributes.color as string | null);
            return color ? { style: `color: ${color}` } : {};
          },
        },
      };
    },
  });
}
