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

const FONT_FAMILY_ENTITY_REGEX = /[&<>"]/g;

/**
 * Escape a font stack for a double-quoted `font-family="…"` MJML attribute.
 * A `"`-quoted family (`"Helvetica Neue", Arial`) must not end the attribute,
 * or the compiler reads it as empty. Unlike `escapeAttr`, single quotes are
 * left alone: they can't end a double-quoted attribute, and they're how the
 * renderer quotes families itself (`'Times New Roman', serif`), so every
 * stack without `&<>"` is emitted byte-for-byte.
 */
export function escapeFontFamily(text: string): string {
  return text.replace(
    FONT_FAMILY_ENTITY_REGEX,
    (char) => HTML_ENTITIES[char] ?? char,
  );
}

export { convertMergeTagsToValues } from "@templatical/types";
