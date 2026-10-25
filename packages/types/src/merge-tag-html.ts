import { findOpenTagEnd, getTagAttrValue } from "./html-scan";

/**
 * Replace merge tag span elements with their data attribute values.
 * Converts `<span data-merge-tag="{{name}}">Label</span>` to `{{name}}`.
 * Also handles `data-logic-merge-tag` attributes.
 *
 * Uses a single-pass linear scan instead of an `[^>]*…[^>]*` regex because
 * the latter is polynomial-ReDoS over inputs that contain many `<span`
 * starts but no closing `>` — the engine retries `[^>]*` at every span
 * position. The scan below resolves each `<span>` open tag with a bounded,
 * quote-aware `findOpenTagEnd`, keeping the work strictly O(n).
 */
export function convertMergeTagsToValues(html: string): string {
  // Preserve the renderer's existing first-close handling of nested spans.
  return rewriteMergeTagSpans(html, (value) => value, false);
}

/**
 * Walk `html`, find every `<span …>…</span>`, and replace the entire span
 * with `replace`'s result for its decoded merge-tag attribute value. Other
 * spans stay intact. Replacements are never scanned again, so callers can
 * substitute opaque placeholders without parsing decoded tokens as HTML.
 */
export function replaceMergeTagSpans(
  html: string,
  replace: (value: string) => string,
): string {
  return rewriteMergeTagSpans(html, replace, true);
}

function rewriteMergeTagSpans(
  html: string,
  replace: (value: string) => string,
  wholeElement: boolean,
): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf("<span", i);
    if (open === -1) {
      out += html.substring(i);
      break;
    }
    // `<span` must be followed by `>` or whitespace to be a real opening tag.
    const afterTagName = html[open + 5];
    if (
      afterTagName !== ">" &&
      afterTagName !== " " &&
      afterTagName !== "\t" &&
      afterTagName !== "\n" &&
      afterTagName !== "\r" &&
      afterTagName !== "/"
    ) {
      out += html.substring(i, open + 5);
      i = open + 5;
      continue;
    }
    const openEnd = findOpenTagEnd(html, open + 5);
    if (openEnd === -1) {
      out += html.substring(i);
      break;
    }
    const attrs = html.substring(open + 5, openEnd);
    const value =
      findAttr(attrs, "data-merge-tag") ??
      findAttr(attrs, "data-logic-merge-tag");
    if (value === null) {
      // This `<span>` isn't a merge-tag — emit up to and including the
      // `<span` literal and let the next iteration scan inward, so any
      // nested merge-tag span still gets a chance to match.
      out += html.substring(i, open + 5);
      i = open + 5;
      continue;
    }
    const closeEnd = findSpanClose(html, openEnd + 1, wholeElement);
    if (closeEnd === -1) {
      out += html.substring(i);
      break;
    }
    out += html.substring(i, open);
    out += replace(value);
    i = closeEnd;
  }
  return out;
}

/** End of the matching close tag, including any nested spans in the label. */
function findSpanClose(
  html: string,
  from: number,
  wholeElement: boolean,
): number {
  if (!wholeElement) {
    const close = html.indexOf("</span>", from);
    return close === -1 ? -1 : close + 7;
  }
  let depth = 1;
  let cursor = from;
  while (cursor < html.length) {
    const open = html.indexOf("<", cursor);
    if (open === -1) return -1;
    const end = findOpenTagEnd(html, open + 1);
    if (end === -1) return -1;
    const closing = html.startsWith("</span", open);
    const opening = html.startsWith("<span", open);
    const boundary = html[open + (closing ? 6 : 5)];
    if (
      (opening || closing) &&
      (boundary === ">" || boundary === "/" || /\s/.test(boundary))
    ) {
      depth += closing ? -1 : 1;
      if (depth === 0) return end + 1;
    }
    cursor = end + 1;
  }
  return -1;
}

/**
 * Extract the value of `name="…"` from an HTML attribute string, or `null`
 * if absent.
 *
 * Delegates to `@templatical/types` so the editor's preview rewriter and this
 * export rewriter read markup identically. They were separate regexes once, and
 * both excluded `<` / `>` from the value — which silently left the whole span
 * in the rendered MJML whenever a consumer configured a merge-tag syntax whose
 * values contain those characters (`<% $email %>`), so the ESP never received
 * the token.
 */
function findAttr(attrs: string, name: string): string | null {
  return getTagAttrValue(attrs, name);
}
