const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

const HTML_ENTITY_REGEX = /[&<>"']/g;

/**
 * Escape HTML special characters (& < > " ').
 * Equivalent to PHP htmlspecialchars with ENT_QUOTES | ENT_HTML5.
 */
export function escapeHtml(text: string): string {
  if (text === "") {
    return "";
  }

  return text.replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Escape a string for use in an HTML attribute value.
 * Same implementation as escapeHtml for consistency with PHP.
 */
export function escapeAttr(text: string): string {
  if (text === "") {
    return "";
  }

  return text.replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Escape a string for use as a CSS property value inside an inline
 * `style="prop: ${value}"` attribute. Beyond HTML entity escaping (so the
 * value survives the attribute boundary), this strips characters that
 * could break out of the property value into a sibling property:
 *
 *   `;`     — separates CSS declarations
 *   `{`/`}` — opens/closes a CSS rule (rejected by attribute parsers but
 *             still safer to remove)
 *   `\n`/`\r` — would smuggle past line-based CSS sanitizers
 *
 * Without this, an attacker-controlled color like
 * `"red; background: url('//attacker/log')"` lands as a real CSS rule.
 */
export function escapeCssValue(text: string): string {
  if (text === "") {
    return "";
  }
  return escapeAttr(text).replace(/[;{}\r\n]/g, "");
}

/**
 * Replace merge tag span elements with their data attribute values.
 * Converts `<span data-merge-tag="{{name}}">Label</span>` to `{{name}}`.
 * Also handles `data-logic-merge-tag` attributes.
 *
 * Uses a single-pass linear scan instead of an `[^>]*…[^>]*` regex because
 * the latter is polynomial-ReDoS over inputs that contain many `<span`
 * starts but no closing `>` — the engine retries `[^>]*` at every span
 * position. The scan below resolves each `<span>` open tag with a bounded
 * `indexOf('>')`, keeping the work strictly O(n).
 */
export function convertMergeTagsToValues(html: string): string {
  if (html === "") {
    return "";
  }

  return rewriteMergeTagSpans(
    html,
    (attrs) =>
      findAttr(attrs, "data-merge-tag") ??
      findAttr(attrs, "data-logic-merge-tag"),
  );
}

/**
 * Walk `html`, find every `<span …>…</span>`, and replace the entire span
 * with whatever `extract` returns for its attribute string (or leave it
 * alone if `extract` returns `null`). Linear in the length of `html`:
 * every `indexOf` advances the cursor monotonically.
 */
function rewriteMergeTagSpans(
  html: string,
  extract: (attrs: string) => string | null,
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
    const openEnd = html.indexOf(">", open + 5);
    if (openEnd === -1) {
      out += html.substring(i);
      break;
    }
    const closeStart = html.indexOf("</span>", openEnd + 1);
    if (closeStart === -1) {
      out += html.substring(i);
      break;
    }
    const attrs = html.substring(open + 5, openEnd);
    const replacement = extract(attrs);
    if (replacement === null) {
      // This `<span>` isn't a merge-tag — emit up to and including the
      // `<span` literal and let the next iteration scan inward, so any
      // nested merge-tag span still gets a chance to match.
      out += html.substring(i, open + 5);
      i = open + 5;
      continue;
    }
    out += html.substring(i, open);
    out += replacement;
    i = closeStart + 7;
  }
  return out;
}

/**
 * Extract the value of `name="…"` from an HTML attribute string, or `null`
 * if absent. Uses `[^<>"]*` for the value match so a missing closing quote
 * fails fast rather than backtracking across the full input.
 */
function findAttr(attrs: string, name: string): string | null {
  const pattern = new RegExp(`(?:^|\\s)${name}="([^"<>]*)"`);
  const match = pattern.exec(attrs);
  return match ? match[1] : null;
}
