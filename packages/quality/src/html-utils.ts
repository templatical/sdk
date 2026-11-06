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
  const stripped = stripHtmlComments(html);
  const tokens = stripped.matchAll(/<\/?a\b[^<>]*>/gi);
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
 * Linear-time `<!-- … -->` stripper. Replaces the original
 * `replace(/<!--[\s\S]*?-->/g, "")`, which had two related problems:
 *
 *   - Polynomial ReDoS: each `<!--` start re-scanned the rest of the
 *     input for `-->`, costing O(n²) over inputs like `<!--<!--<!--…`.
 *   - Incomplete sanitization: an unterminated `<!--` left the literal
 *     `<!--` in the output, so downstream rendering could still parse it
 *     as an open HTML comment and swallow the rest of the document.
 *
 * The scanner discards an unterminated comment entirely — there is no
 * way to recover meaningful content after a stray `<!--`, and leaving
 * it in would re-introduce the sanitizer gap.
 */
function stripHtmlComments(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const start = html.indexOf("<!--", i);
    if (start === -1) {
      out += html.substring(i);
      break;
    }
    out += html.substring(i, start);
    const end = html.indexOf("-->", start + 4);
    if (end === -1) {
      // Unterminated comment — drop everything from this point onward.
      break;
    }
    i = end + 3;
  }
  return out;
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

/**
 * One attribute inside an open tag's attribute string. `start` is the first
 * character of the name; `end` is just after the value (closing quote
 * included, or the end of an unquoted value).
 */
export interface AttrSpan {
  start: number;
  end: number;
}

function isHtmlWhitespace(char: string): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\f"
  );
}

// Same name class as `getTagAttrValue`, so a span slice is the attribute it reads.
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

function isTagNameStart(char: string): boolean {
  return (char >= "A" && char <= "Z") || (char >= "a" && char <= "z");
}

function isTagNameChar(char: string): boolean {
  return (
    isTagNameStart(char) ||
    (char >= "0" && char <= "9") ||
    char === ":" ||
    char === "-" ||
    char === "_"
  );
}

/**
 * `name="value"`. A `"` in the value is written as `&quot;` so it cannot
 * close the attribute or start a sibling one. `&` and existing entities are
 * copied as written. A double-quoted value contains no raw `"`, so passing
 * its raw text through here leaves those bytes unchanged.
 */
export function doubleQuotedAttr(name: string, value: string): string {
  return `${name}="${value.replace(/"/g, "&quot;")}"`;
}

/**
 * Raw value text of one attribute span from `findAttrSpans`, with the
 * surrounding quotes removed. Entities stay as written. Returns null when
 * the span is a boolean attribute (no `=`) or its quoted value never closes.
 */
export function attrRawValue(attr: string): string | null {
  let i = 0;
  while (i < attr.length && isAttrNameChar(attr[i])) i++;
  while (i < attr.length && isHtmlWhitespace(attr[i])) i++;
  if (i >= attr.length || attr[i] !== "=") return null;
  i++;
  while (i < attr.length && isHtmlWhitespace(attr[i])) i++;
  if (i >= attr.length) return null;
  const quote = attr[i];
  if (quote === '"' || quote === "'") {
    const end = attr.indexOf(quote, i + 1);
    if (end === -1) return null;
    return attr.slice(i + 1, end);
  }
  return attr.slice(i);
}

/**
 * Spans of `name` inside an open tag's attribute string (between the tag
 * name and its `>`). Quote-aware, like `getTagAttrValue`: a single-quoted
 * value may contain `"`, and an unquoted value ends at whitespace. Returns
 * null when a quoted value never closes — the string is not safe to rewrite.
 */
export function findAttrSpans(attrs: string, name: string): AttrSpan[] | null {
  const target = name.toLowerCase();
  const spans: AttrSpan[] = [];
  let i = 0;

  while (i < attrs.length) {
    while (
      i < attrs.length &&
      (isHtmlWhitespace(attrs[i]) || attrs[i] === "/")
    ) {
      i++;
    }
    if (i >= attrs.length) break;

    const nameStart = i;
    while (i < attrs.length && isAttrNameChar(attrs[i])) i++;
    const attrName = attrs.slice(nameStart, i);
    if (attrName === "") {
      i++;
      continue;
    }
    const nameEnd = i;

    while (i < attrs.length && isHtmlWhitespace(attrs[i])) i++;
    if (i >= attrs.length || attrs[i] !== "=") {
      if (attrName.toLowerCase() === target) {
        spans.push({ start: nameStart, end: nameEnd });
      }
      continue;
    }
    i++; // past `=`
    while (i < attrs.length && isHtmlWhitespace(attrs[i])) i++;

    const quote = attrs[i];
    if (quote === '"' || quote === "'") {
      const valueEnd = attrs.indexOf(quote, i + 1);
      if (valueEnd === -1) return null;
      const end = valueEnd + 1;
      if (attrName.toLowerCase() === target)
        spans.push({ start: nameStart, end });
      i = end;
      continue;
    }

    while (
      i < attrs.length &&
      !isHtmlWhitespace(attrs[i]) &&
      attrs[i] !== ">"
    ) {
      i++;
    }
    if (attrName.toLowerCase() === target)
      spans.push({ start: nameStart, end: i });
  }

  return spans;
}

/**
 * Drop one attribute, including a single whitespace separator before its
 * name when there is one. The rest of the attribute string stays byte for
 * byte, so a removed `style` leaves `<p>` rather than `<p >`.
 */
export function removeAttrSpan(attrs: string, span: AttrSpan): string {
  const from =
    span.start > 0 && isHtmlWhitespace(attrs[span.start - 1])
      ? span.start - 1
      : span.start;
  return attrs.slice(0, from) + attrs.slice(span.end);
}

/**
 * Rewrite open tags in `html`. `visit` returns a replacement for the whole
 * tag, angle brackets included, or null to keep the original bytes.
 *
 * Parser offsets keep quoted `>` inside attributes and skip comments and
 * raw text. Tags the parser does not open stay unchanged.
 */
export function rewriteOpenTags(
  html: string,
  visit: (tag: {
    name: string;
    rawName: string;
    attrs: string;
    decodedAttrs: Record<string, string>;
  }) => string | null,
): string {
  let out = "";
  let copiedTo = 0;
  const parser = new Parser({
    onopentag(name, decodedAttrs) {
      const open = parser.startIndex;
      const tagEnd = parser.endIndex;
      if (!isTagNameStart(html[open + 1])) return;
      let nameEnd = open + 1;
      while (nameEnd < tagEnd && isTagNameChar(html[nameEnd])) nameEnd++;
      const rawName = html.slice(open + 1, nameEnd);
      const attrs = html.slice(nameEnd, tagEnd);
      const replacement = visit({ name, rawName, attrs, decodedAttrs });
      if (replacement === null) return;
      out += html.slice(copiedTo, open);
      out += replacement;
      copiedTo = tagEnd + 1;
    },
  });
  parser.end(html);
  return out + html.slice(copiedTo);
}
