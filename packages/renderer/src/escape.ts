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
 */
export function convertMergeTagsToValues(html: string): string {
  if (html === "") {
    return "";
  }

  // Replace <span data-merge-tag="...">...</span> with the merge tag value
  let result = html.replace(
    /<span[^>]*\bdata-merge-tag="([^"]*)"[^>]*>.*?<\/span>/gs,
    "$1",
  );

  // Replace <span data-logic-merge-tag="...">...</span> with the merge tag value
  result = result.replace(
    /<span[^>]*\bdata-logic-merge-tag="([^"]*)"[^>]*>.*?<\/span>/gs,
    "$1",
  );

  return result;
}
