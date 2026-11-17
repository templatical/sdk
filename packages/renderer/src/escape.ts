// Every helper here returns "" for null and undefined. Stored template JSON
// can hold null where a block type says string (a backend that turns every ""
// into null), and the email must still render, with that field empty.

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/** Characters that must be escaped in element text. */
const HTML_ENTITY_REGEX = /[&<>]/g;

/**
 * Escape element text (content between tags). Escapes `&`, `<` and `>`
 * (`&amp;`, `&lt;`, `&gt;`). A `'` and a `"` stay raw: element text never
 * needs quote escaping, and a merge tag with a quoted argument
 * (`{{ x|default('y') }}`) must reach a send-time template engine intact.
 * Never for an attribute value: `escapeAttr` is the one to use there.
 */
export function escapeHtml(text: string | null | undefined): string {
  if (text === null || text === undefined || text === "") {
    return "";
  }

  return text.replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITIES[char]);
}

/** Characters that can end or break a double-quoted attribute value. */
const ATTR_ENTITY_REGEX = /[&<>"]/g;

/**
 * Escape a value for a double-quoted attribute, which is how the renderer
 * writes every attribute. Escapes `&`, `<`, `>` and `"` (`&amp;`, `&lt;`,
 * `&gt;`, `&quot;`). A `'` stays raw: inside double quotes it cannot end the
 * value, and a quoted argument in a merge tag (`{{ x|default('y') }}`) must
 * reach a send-time template engine intact.
 */
export function escapeAttr(text: string | null | undefined): string {
  if (text === null || text === undefined || text === "") {
    return "";
  }

  return text.replace(ATTR_ENTITY_REGEX, (char) => HTML_ENTITIES[char]);
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
export function escapeCssValue(text: string | null | undefined): string {
  if (text === null || text === undefined || text === "") {
    return "";
  }
  // Strip before escaping, so the `;` that ends each `&quot;` survives.
  return escapeAttr(text.replace(/[;{}\r\n]/g, ""));
}

/**
 * Escape a font stack for a double-quoted `font-family="…"` MJML attribute.
 * A `"`-quoted family (`"Helvetica Neue", Arial`) must not end the attribute,
 * or the compiler reads it as empty. A `'` stays raw: it cannot end a
 * double-quoted attribute, and the renderer quotes families itself
 * (`'Times New Roman', serif`), so every stack without `&<>"` is emitted
 * byte-for-byte.
 */
export function escapeFontFamily(text: string | null | undefined): string {
  return escapeAttr(text);
}

export { convertMergeTagsToValues } from "@templatical/types";
