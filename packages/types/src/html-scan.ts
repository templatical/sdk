/**
 * Minimal, allocation-free primitives for reading an HTML open tag out of a
 * markup string. They exist because merge-tag markup is rewritten from a raw
 * string in two packages — `@templatical/types` (label / sample resolution for
 * the previews) and `@templatical/renderer` (converting spans back to tokens on
 * export) — and both need the same two answers: where does this open tag end,
 * and what is the value of one of its attributes.
 *
 * Both are hand-written character scans rather than regexes. A regex over an
 * attribute string with no closing quote backtracks across the whole input,
 * which is the ReDoS class the span scanners were rewritten to avoid; a scan
 * that only moves forward cannot.
 */

const QUOTES = new Set(['"', "'"]);

/**
 * Index of the `>` that closes the open tag whose name ends at `from`, or `-1`
 * when the tag never closes.
 *
 * Quote-aware: a `>` inside a quoted attribute value does not end the tag.
 * That matters because a consumer may configure a merge-tag syntax whose tag
 * values contain `<` / `>` — Smarty-style `<% $email %>` — and HTML attribute
 * serialization escapes only `&`, `"` and U+00A0, so those characters reach the
 * markup literally. A plain `indexOf(">")` stops mid-attribute there and every
 * caller downstream sees a truncated attribute string.
 *
 * An unterminated quote yields `-1` rather than a guessed tag end: callers
 * treat that as "not markup I can rewrite" and emit the input untouched, which
 * is the safe answer for malformed HTML.
 */
export function findOpenTagEnd(html: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < html.length; i++) {
    const char = html[i];
    if (quote !== null) {
      if (char === quote) quote = null;
      continue;
    }
    if (QUOTES.has(char)) {
      quote = char;
      continue;
    }
    if (char === ">") return i;
  }
  return -1;
}

function isAttrNameChar(char: string): boolean {
  return (
    char !== " " &&
    char !== "\t" &&
    char !== "\n" &&
    char !== "\r" &&
    char !== "\f" &&
    char !== "=" &&
    char !== ">" &&
    char !== "/"
  );
}

function isWhitespace(char: string): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\f"
  );
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Decode the character references an HTML serializer writes into an attribute
 * value, so callers get the characters the author wrote.
 *
 * Deliberately small: the named set a serializer actually emits, plus numeric
 * references. An unknown or malformed reference is left as literal text, which
 * is what a browser does. Single-pass — `&amp;lt;` decodes to the text `&lt;`
 * and stops, never to `<`, so an escaped entity inside a consumer's tag value
 * survives as itself.
 */
function decodeAttrEntities(value: string): string {
  if (!value.includes("&")) return value;
  return value.replace(
    /&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (match, ref: string) => {
      if (ref[0] === "#") {
        const code =
          ref[1] === "x" || ref[1] === "X"
            ? Number.parseInt(ref.slice(2), 16)
            : Number.parseInt(ref.slice(1), 10);
        // Surrogates and out-of-range code points would throw; leave them be.
        if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return match;
        if (code >= 0xd800 && code <= 0xdfff) return match;
        return String.fromCodePoint(code);
      }
      return NAMED_ENTITIES[ref.toLowerCase()] ?? match;
    },
  );
}

/**
 * The value of the `name` attribute within an open tag's attribute string (the
 * text between the tag name and its closing `>`), or `null` when the attribute
 * is absent or its quoted value is never closed.
 *
 * Handles double-quoted, single-quoted and unquoted values, and matches the
 * attribute name case-insensitively, as HTML does. The value is
 * entity-decoded, because that is what the attribute means: the editor
 * serializes a tag value of `<% $email %>` as
 * `data-merge-tag="&lt;% $email %&gt;"`, and every caller compares the result
 * against a configured merge-tag token written in raw characters.
 */
export function getTagAttrValue(attrs: string, name: string): string | null {
  const target = name.toLowerCase();
  let i = 0;

  while (i < attrs.length) {
    while (i < attrs.length && (isWhitespace(attrs[i]) || attrs[i] === "/")) {
      i++;
    }
    if (i >= attrs.length) break;

    const nameStart = i;
    while (i < attrs.length && isAttrNameChar(attrs[i])) i++;
    const attrName = attrs.substring(nameStart, i).toLowerCase();
    if (attrName === "") {
      // Not a name character and not whitespace — e.g. a stray `=`. Step over
      // it so the scan always advances.
      i++;
      continue;
    }

    while (i < attrs.length && isWhitespace(attrs[i])) i++;
    if (attrs[i] !== "=") {
      // A boolean attribute (`hidden`); the cursor already sits on the next
      // attribute name, so don't consume anything here.
      continue;
    }
    i++; // past `=`
    while (i < attrs.length && isWhitespace(attrs[i])) i++;

    const quote = attrs[i];
    if (QUOTES.has(quote)) {
      const valueStart = i + 1;
      const valueEnd = attrs.indexOf(quote, valueStart);
      if (valueEnd === -1) return null; // unterminated value — nothing readable follows
      if (attrName === target)
        return decodeAttrEntities(attrs.substring(valueStart, valueEnd));
      i = valueEnd + 1;
      continue;
    }

    const valueStart = i;
    while (i < attrs.length && !isWhitespace(attrs[i]) && attrs[i] !== ">") i++;
    if (attrName === target)
      return decodeAttrEntities(attrs.substring(valueStart, i));
  }

  return null;
}
