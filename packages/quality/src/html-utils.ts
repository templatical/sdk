import { Parser } from "htmlparser2";

export interface AnchorInfo {
  href: string;
  text: string;
  target: string | null;
  rel: string | null;
  /** True if the anchor wraps an image with non-empty alt. */
  hasImageWithAlt: boolean;
}

/**
 * Extract every anchor from a TipTap-style HTML fragment. Used by
 * link-* rules. Doesn't try to be a full DOM — only the data the rules
 * need.
 *
 * Nested `<a>` is invalid HTML; htmlparser2 follows the HTML5 spec and
 * emits an implicit `</a>` when a second `<a>` opens, so anchors are
 * effectively flat siblings. We mirror that with a single in-flight
 * anchor (no stack); a defensive finalize-on-reopen handles the
 * theoretical case where the parser ever stops emitting the implicit
 * close. Detecting nested-anchor markup as its own concern lives in
 * the `a11y.link-nested-anchor` rule, which inspects the raw input
 * before this normalization.
 */
export function extractAnchors(html: string): AnchorInfo[] {
  const anchors: AnchorInfo[] = [];
  let current: AnchorInfo | null = null;
  let buffer = "";

  const finalize = () => {
    if (current === null) return;
    current.text = buffer.trim();
    anchors.push(current);
    current = null;
    buffer = "";
  };

  const parser = new Parser({
    onopentag(name, attribs) {
      if (name === "a") {
        finalize();
        current = {
          href: attribs.href ?? "",
          text: "",
          target: attribs.target ?? null,
          rel: attribs.rel ?? null,
          hasImageWithAlt: false,
        };
        return;
      }

      if (name === "img" && current !== null) {
        const alt = (attribs.alt ?? "").trim();
        if (alt !== "") {
          current.hasImageWithAlt = true;
        }
      }
    },
    ontext(text) {
      if (current !== null) {
        buffer += text;
      }
    },
    onclosetag(name) {
      if (name === "a") {
        finalize();
      }
    },
  });

  parser.write(html);
  parser.end();
  finalize();

  return anchors;
}

/**
 * Whether the raw HTML contains an `<a>` opened inside another open
 * `<a>` — invalid markup that htmlparser2 silently normalizes by
 * emitting an implicit `</a>` before the inner open. `extractAnchors`
 * runs against the normalized parse and therefore can't distinguish
 * nested-from-sibling input; this helper inspects the raw text so the
 * `a11y.link-nested-anchor` rule can flag the structural problem.
 *
 * Tokenization here ignores anchor-like tokens inside HTML comments,
 * which is enough for TipTap email-template HTML. CDATA, `<script>`,
 * and attribute-value occurrences aren't expected in this surface.
 */
export function hasNestedAnchors(html: string): boolean {
  const stripped = html.replace(/<!--[\s\S]*?-->/g, "");
  const tokens = stripped.matchAll(/<\/?a\b[^>]*>/gi);
  let depth = 0;
  for (const match of tokens) {
    if (match[0].startsWith("</")) {
      if (depth > 0) depth--;
      continue;
    }
    if (depth > 0) return true;
    depth++;
  }
  return false;
}

/**
 * Strip tags and return the visible text content of an HTML fragment.
 * Used by heading-empty and other text-presence rules.
 */
export function extractText(html: string): string {
  let text = "";
  const parser = new Parser({
    ontext(chunk) {
      text += chunk;
    },
  });
  parser.write(html);
  parser.end();
  return text.trim();
}
