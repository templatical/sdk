/**
 * Character references Beefree writes inside `{{ }}`, `{% %}` and `{# #}`.
 * A sender parses those tokens before an HTML parser does, so `&#39;` has to
 * be an apostrophe in the imported string. References outside a token stay
 * encoded. An opener with no closer is left as written. Each reference is
 * decoded once: `&amp;quot;` becomes `&quot;`.
 *
 * The three kinds are scanned with `indexOf`. The earliest opener wins, and
 * the match ends at that kind's first closer. A kind with no closer can never
 * match later in the string, so it is not searched again.
 */
const TOKEN_KINDS = [
  { opener: "{{", closer: "}}" },
  { opener: "{%", closer: "%}" },
  { opener: "{#", closer: "#}" },
] as const;

interface TokenSeek {
  opener: string;
  closer: string;
  /** Next opener index, or -1 when none remains. */
  at: number;
  searched: boolean;
  /** No closer exists for this opener, or no opener remains. */
  dead: boolean;
}

interface TokenSpan {
  start: number;
  end: number;
}

function tokenSeeks(): TokenSeek[] {
  return TOKEN_KINDS.map((kind) => ({
    opener: kind.opener,
    closer: kind.closer,
    at: -1,
    searched: false,
    dead: false,
  }));
}

/** Next opener of this kind at or after `from`, cached so each index is visited once. */
function openerAt(value: string, seek: TokenSeek, from: number): number {
  if (seek.dead) return -1;
  if (seek.searched && (seek.at === -1 || seek.at >= from)) return seek.at;
  seek.at = value.indexOf(seek.opener, from);
  seek.searched = true;
  if (seek.at === -1) seek.dead = true;
  return seek.at;
}

/**
 * The next token at or after `from`, or `null` when none remain.
 * An unterminated opener stays in the text: the scan resumes one character
 * later, and that opener kind is not tried again.
 */
function nextToken(
  value: string,
  from: number,
  seeks: TokenSeek[],
): TokenSpan | null {
  let cursor = from;
  while (cursor < value.length) {
    let best = -1;
    let kind = -1;
    for (let i = 0; i < seeks.length; i++) {
      const at = openerAt(value, seeks[i], cursor);
      if (at === -1) continue;
      if (best === -1 || at < best) {
        best = at;
        kind = i;
      }
    }
    if (kind === -1 || best === -1) break;
    const seek = seeks[kind];
    const closeAt = value.indexOf(seek.closer, best + seek.opener.length);
    if (closeAt === -1) {
      seek.dead = true;
      cursor = best + 1;
      continue;
    }
    return { start: best, end: closeAt + seek.closer.length };
  }
  return null;
}

function tokenSpans(value: string): TokenSpan[] {
  const seeks = tokenSeeks();
  const spans: TokenSpan[] = [];
  let from = 0;
  while (from < value.length) {
    const span = nextToken(value, from, seeks);
    if (!span) break;
    spans.push(span);
    from = span.end;
  }
  return spans;
}

const CHAR_REF = /&(?:amp|lt|gt|quot|apos|nbsp|#x[0-9a-f]+|#\d+);/gi;

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00A0",
};

/** A scalar character, or the reference itself when the code point is not one. */
function decodeCharRef(entity: string): string {
  const body = entity.slice(1, -1);
  if (body[0] !== "#") return NAMED[body.toLowerCase()] ?? entity;

  const hex = body[1] === "x" || body[1] === "X";
  const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
  // `&#0;` and a surrogate are not characters a token can use.
  if (
    !Number.isInteger(code) ||
    code < 1 ||
    code > 0x10ffff ||
    (code >= 0xd800 && code <= 0xdfff)
  ) {
    return entity;
  }
  return String.fromCodePoint(code);
}

/**
 * Encoded form of a decoded character that must not appear raw, or
 * `undefined` when the character is safe in this context.
 */
type Preserve = (char: string) => string | undefined;

function decodeToken(token: string, preserve?: Preserve): string {
  CHAR_REF.lastIndex = 0;
  const decoded = token.replace(CHAR_REF, (entity) => {
    const char = decodeCharRef(entity);
    return preserve?.(char) ?? char;
  });
  // Twig's lexer does not treat U+00A0 as whitespace; Beefree's export uses a plain space.
  return decoded.replace(/\u00A0/g, (char) => preserve?.(char) ?? " ");
}

function decodeEntities(
  value: string,
  preserve?: Preserve,
  ctx?: Uint8Array,
): string {
  const seeks = tokenSeeks();
  const parts: string[] = [];
  let i = 0;
  let from = 0;
  let found = false;
  while (from < value.length) {
    const span = nextToken(value, from, seeks);
    if (!span) break;
    found = true;
    if (span.start > i) parts.push(value.slice(i, span.start));
    parts.push(
      ctx
        ? decodeTokenAt(value, span.start, span.end, ctx)
        : decodeToken(value.slice(span.start, span.end), preserve),
    );
    i = span.end;
    from = span.end;
  }
  if (!found) return value;
  if (i < value.length) parts.push(value.slice(i));
  return parts.join("");
}

export function decodeEntitiesInTokens(value: string): string {
  return decodeEntities(value);
}

/** A quote stays `&quot;` so it cannot end a double-quoted attribute. */
const preserveDoubleQuote: Preserve = (char) =>
  char === '"' ? "&quot;" : undefined;

/** An apostrophe stays `&#39;` so it cannot end a single-quoted attribute. */
const preserveSingleQuote: Preserve = (char) =>
  char === "'" ? "&#39;" : undefined;

/**
 * Characters that end an unquoted attribute (`whitespace` or `>`) or that
 * a loose parser treats as a quote. A decoded `&nbsp;` is one of those spaces.
 */
const preserveUnquoted: Preserve = (char) => {
  switch (char) {
    case '"':
      return "&quot;";
    case "'":
      return "&#39;";
    case ">":
      return "&gt;";
    case " ":
      return "&#32;";
    case "\t":
      return "&#9;";
    case "\n":
      return "&#10;";
    case "\r":
      return "&#13;";
    case "\f":
      return "&#12;";
    case "\u00A0":
      return "&nbsp;";
    default:
      return undefined;
  }
};

/**
 * Decode references inside tokens that will sit in a double-quoted attribute.
 * `&#39;` becomes `'`, `&gt;` `>`, `&lt;` `<`, `&amp;` `&` and `&nbsp;` a
 * space. A quote (`&quot;`, `&#34;`, `&#x22;`, any case or leading zeros)
 * stays `&quot;`, so the token cannot end the attribute.
 */
export function decodeEntitiesInTokensForAttribute(value: string): string {
  return decodeEntities(value, preserveDoubleQuote);
}

/** Text or a comment: decode a reference in full. */
const CTX_TEXT = 0;
/** A double-quoted attribute value. */
const CTX_DQ = 1;
/** A single-quoted attribute value. */
const CTX_SQ = 2;
/** An unquoted attribute value. */
const CTX_UQ = 3;
/** Tag markup outside an attribute value. A reference here stays encoded. */
const CTX_OPAQUE = 4;

const PRESERVE_BY_KIND: Array<Preserve | undefined> = [];
PRESERVE_BY_KIND[CTX_TEXT] = undefined;
PRESERVE_BY_KIND[CTX_DQ] = preserveDoubleQuote;
PRESERVE_BY_KIND[CTX_SQ] = preserveSingleQuote;
PRESERVE_BY_KIND[CTX_UQ] = preserveUnquoted;

function replacementFor(char: string, kind: number): string {
  const preserve = PRESERVE_BY_KIND[kind];
  const kept = preserve?.(char);
  return kept ?? (char === "\u00A0" ? " " : char);
}

/** Copy `slice[from, to)`, turning a literal U+00A0 into a space inside a token. */
function copyPlain(
  slice: string,
  from: number,
  to: number,
  base: number,
  ctx: Uint8Array,
): string {
  const nbsp = slice.indexOf("\u00A0", from);
  if (nbsp === -1 || nbsp >= to) return slice.slice(from, to);
  const parts: string[] = [];
  let i = from;
  while (i < to) {
    const at = slice.indexOf("\u00A0", i);
    if (at === -1 || at >= to) {
      parts.push(slice.slice(i, to));
      break;
    }
    if (at > i) parts.push(slice.slice(i, at));
    const kind = ctx[base + at];
    parts.push(kind === CTX_OPAQUE ? "\u00A0" : replacementFor("\u00A0", kind));
    i = at + 1;
  }
  return parts.join("");
}

/**
 * Decode references in `html[start, end)`. Each reference uses the context
 * of its own index, so one token can span a text node and an attribute.
 */
function decodeTokenAt(
  html: string,
  start: number,
  end: number,
  ctx: Uint8Array,
): string {
  const slice = html.slice(start, end);
  if (slice.indexOf("&") === -1 && slice.indexOf("\u00A0") === -1) return slice;
  const parts: string[] = [];
  CHAR_REF.lastIndex = 0;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = CHAR_REF.exec(slice))) {
    parts.push(copyPlain(slice, last, match.index, start, ctx));
    const kind = ctx[start + match.index];
    parts.push(
      kind === CTX_OPAQUE
        ? match[0]
        : replacementFor(decodeCharRef(match[0]), kind),
    );
    last = match.index + match[0].length;
  }
  parts.push(copyPlain(slice, last, slice.length, start, ctx));
  return parts.join("");
}

interface ValueSpan {
  start: number;
  end: number;
  kind: number;
}

/** Paint the tag opaque, then lay each attribute value back over it. */
function paintTag(
  ctx: Uint8Array,
  start: number,
  end: number,
  values: ValueSpan[],
): number {
  ctx.fill(CTX_OPAQUE, start, end);
  for (const value of values) ctx.fill(value.kind, value.start, value.end);
  return end;
}

/**
 * Mark attribute values on the tag at `start`. `null` when the tag never
 * closes: the caller leaves that tail as written.
 */
function markTag(html: string, start: number, ctx: Uint8Array): number | null {
  const values: ValueSpan[] = [];
  let i = start + 1;
  let state: "tag" | "before" | "quoted" | "unquoted" = "tag";
  let quote = "";
  let valueStart = 0;

  while (i < html.length) {
    const char = html[i];
    if (state === "quoted") {
      if (char !== quote) {
        i++;
        continue;
      }
      values.push({
        start: valueStart,
        end: i,
        kind: quote === '"' ? CTX_DQ : CTX_SQ,
      });
      state = "tag";
      i++;
      continue;
    }
    if (state === "unquoted") {
      if (char !== ">" && !isSpace(char)) {
        i++;
        continue;
      }
      values.push({ start: valueStart, end: i, kind: CTX_UQ });
      state = "tag";
      if (char === ">") return paintTag(ctx, start, i + 1, values);
      i++;
      continue;
    }
    if (state === "before") {
      if (isSpace(char)) {
        i++;
        continue;
      }
      if (char === ">") return paintTag(ctx, start, i + 1, values);
      if (char === '"' || char === "'") {
        quote = char;
        valueStart = i + 1;
        state = "quoted";
        i++;
        continue;
      }
      valueStart = i;
      state = "unquoted";
      continue;
    }
    if (char === "=") {
      state = "before";
      i++;
      continue;
    }
    if (char === ">") return paintTag(ctx, start, i + 1, values);
    i++;
  }
  return null;
}

interface HtmlContext {
  ctx: Uint8Array;
  /** Start of an unclosed tag, or `html.length` when every tag closes. */
  limit: number;
}

/**
 * Context of each index. Text and comments stay `CTX_TEXT`. An attribute
 * value is marked for its quotes. The rest of a closed tag is opaque.
 * `limit` stops the token scan at an unclosed tag, which is left as written.
 */
function markHtmlContext(html: string): HtmlContext {
  const ctx = new Uint8Array(html.length);
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      if (end === -1) break;
      i = end + 3;
      continue;
    }
    const next = markTag(html, lt, ctx);
    if (next === null) return { ctx, limit: lt };
    i = next;
  }
  return { ctx, limit: html.length };
}

/**
 * Decode tokens in HTML. A token is the earliest `{{`, `{%` or `{#` through
 * its first closer, and it may span tags. A reference in text or a comment
 * is decoded in full, so a quote there is a quote and U+00A0 is a space.
 * A reference inside an attribute is decoded for the quotes that wrap it:
 * a double-quoted value keeps `"`, a single-quoted value keeps `'`, and an
 * unquoted value keeps the characters that end it. A reference in the tag
 * itself stays encoded. An unclosed tag is left as written, and a token
 * does not close inside it.
 */
export function decodeEntitiesInHtml(html: string): string {
  if (html.indexOf("<") === -1) return decodeEntitiesInTokens(html);
  const marked = markHtmlContext(html);
  const head =
    marked.limit === html.length ? html : html.slice(0, marked.limit);
  const decoded = decodeEntities(head, undefined, marked.ctx);
  return marked.limit === html.length
    ? decoded
    : decoded + html.slice(marked.limit);
}

/**
 * Every character reference in plain text, decoded once. A button label is
 * not HTML: the renderer escapes it, so `&nbsp;` has to be the character or
 * the mail shows the letters `&amp;nbsp;`.
 */
export function decodePlainTextEntities(value: string): string {
  CHAR_REF.lastIndex = 0;
  return value.replace(CHAR_REF, decodeCharRef);
}

/**
 * BeeFree writes a non-breaking space as `&amp;nbsp;`. The extra `&amp;`
 * leaves the letters `&nbsp;` in the mail. Put back the single reference.
 * Any other reference outside a token stays as written.
 */
export function restoreDoubledNbsp(html: string): string {
  return html.replace(/&amp;(nbsp;|#0*160;|#x0*a0;)/gi, "&$1");
}

/** Whitespace, or a reference that decodes to whitespace, up to the extra `&amp;` on `&amp;nbsp;`. */
function isSpacePadding(text: string): boolean {
  let current = text;
  for (let pass = 0; pass < 2; pass++) {
    CHAR_REF.lastIndex = 0;
    const next = current.replace(CHAR_REF, decodeCharRef);
    if (next === current) break;
    current = next;
  }
  return /^[\s\u00A0]*$/.test(current);
}

/**
 * A chip between two merge tags holds only a non-breaking space (kept as one
 * plain space), and a chip
 * around one token leads with plain spaces that are not part of the token.
 * A non-breaking space in front of that token stays: it is the space between
 * the previous word and the token. A chip
 * that also carries words, or more than one token, is left as written. A
 * space after the token stays: it is the space the author typed.
 */
/** Plain spaces the editor pads in front of a token. A non-breaking space is not padding. */
function isPlainSpacePadding(text: string): boolean {
  return /^[ \t\n\r\f]*$/.test(text);
}

/** Drop a plain leading space before the one token in `text`. A non-breaking space stays. */
function withoutLeadingTokenPadding(text: string): string {
  const spans = tokenSpans(text);
  if (spans.length !== 1) return text;
  const start = spans[0].start;
  if (!isPlainSpacePadding(text.slice(0, start))) return text;
  return text.slice(start);
}

/**
 * What a mergetag chip keeps once nested chips are already unwrapped.
 * A chip that only holds a space between two tokens is that space. A plain
 * leading space before the one token is padding and drops.
 */
function keptMergetagText(text: string): string {
  const spans = tokenSpans(text);
  if (spans.length !== 1) {
    return text !== "" && isSpacePadding(text) ? " " : text;
  }
  return withoutLeadingTokenPadding(text);
}

function fold(char: string): string {
  const code = char.charCodeAt(0);
  return code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : char;
}

function equalsIgnoreCase(value: string, literal: string): boolean {
  if (value.length !== literal.length) return false;
  for (let i = 0; i < value.length; i++) {
    if (fold(value[i]) !== fold(literal[i])) return false;
  }
  return true;
}

function startsWithIgnoreCase(
  html: string,
  at: number,
  literal: string,
): boolean {
  if (at < 0 || at + literal.length > html.length) return false;
  for (let i = 0; i < literal.length; i++) {
    if (fold(html[at + i]) !== fold(literal[i])) return false;
  }
  return true;
}

function isSpace(char: string | undefined): boolean {
  return (
    char === " " ||
    char === "\t" ||
    char === "\n" ||
    char === "\r" ||
    char === "\f"
  );
}

/** A character that continues an HTML tag name (`code` vs `codebook`). */
function isNameChar(char: string | undefined): boolean {
  if (char === undefined) return false;
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    char === "-" ||
    char === ":" ||
    char === "_"
  );
}

const CODE_TAG = "code";

/**
 * Index of the next `<code` tag at or after `from` and before `limit`, or -1.
 * `<codebook` is not one. `limit` keeps a chip from scanning past its closer.
 */
function indexOfCodeOpen(
  html: string,
  from: number,
  limit = html.length,
): number {
  let i = from;
  while (i < limit) {
    const at = html.indexOf("<", i);
    if (at === -1 || at >= limit) return -1;
    if (
      startsWithIgnoreCase(html, at + 1, CODE_TAG) &&
      !isNameChar(html[at + 1 + CODE_TAG.length])
    ) {
      return at;
    }
    i = at + 1;
  }
  return -1;
}

/**
 * Index just after the `>` that ends the tag at `open`. A quoted `>` is part
 * of an attribute (`data-bee-code="{% if n > 1 %}"`), not the end of the tag.
 * -1 when the tag never closes.
 */
function endOfTag(html: string, open: number): number {
  let quote: string | null = null;
  for (let i = open + 1; i < html.length; i++) {
    const char = html[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return i + 1;
  }
  return -1;
}

/** `<code … />`, with whitespace allowed before the slash. */
function isSelfClosing(html: string, openEnd: number): boolean {
  let i = openEnd - 2;
  while (i >= 0 && isSpace(html[i])) i--;
  return html[i] === "/";
}

/**
 * The open tag carries `data-bee-type="mergetag"`. The attribute may sit
 * anywhere, in double quotes, single quotes, or none.
 */
function isMergetagOpen(html: string, open: number, openEnd: number): boolean {
  let i = open + 1 + CODE_TAG.length;
  const end = openEnd - 1;
  while (i < end) {
    while (i < end && isSpace(html[i])) i++;
    if (i >= end || html[i] === "/") break;
    const nameStart = i;
    while (i < end && !isSpace(html[i]) && html[i] !== "=" && html[i] !== "/") {
      i++;
    }
    const name = html.slice(nameStart, i);
    while (i < end && isSpace(html[i])) i++;
    let value = "";
    if (html[i] === "=") {
      i++;
      while (i < end && isSpace(html[i])) i++;
      const quote = html[i];
      if (quote === '"' || quote === "'") {
        i++;
        const valueStart = i;
        while (i < end && html[i] !== quote) i++;
        value = html.slice(valueStart, i);
        if (html[i] === quote) i++;
      } else {
        const valueStart = i;
        while (i < end && !isSpace(html[i]) && html[i] !== "/") i++;
        value = html.slice(valueStart, i);
      }
    }
    if (equalsIgnoreCase(name, "data-bee-type") && value === "mergetag") {
      return true;
    }
  }
  return false;
}

interface CodeClose {
  start: number;
  end: number;
}

/** Index just after the `>` of a `</code>` at `at`, or -1 when `at` is not one. */
function codeCloseEnd(html: string, at: number): number {
  if (!startsWithIgnoreCase(html, at + 1, `/${CODE_TAG}`)) return -1;
  let j = at + 2 + CODE_TAG.length;
  while (j < html.length && isSpace(html[j])) j++;
  return html[j] === ">" ? j + 1 : -1;
}

/**
 * The matching `</code>` for every `<code>` that has one, counting nested
 * `<code>` elements. One forward pass: an unclosed tag does not make every
 * later tag scan the rest of the string.
 */
function indexCodeCloses(html: string): Map<number, CodeClose> {
  const closes = new Map<number, CodeClose>();
  const stack: number[] = [];
  let i = 0;
  while (i < html.length) {
    const at = html.indexOf("<", i);
    if (at === -1) break;
    const closeEnd = codeCloseEnd(html, at);
    if (closeEnd !== -1) {
      const open = stack.pop();
      if (open !== undefined) closes.set(open, { start: at, end: closeEnd });
      i = closeEnd;
      continue;
    }
    if (
      startsWithIgnoreCase(html, at + 1, CODE_TAG) &&
      !isNameChar(html[at + 1 + CODE_TAG.length])
    ) {
      const openEnd = endOfTag(html, at);
      if (openEnd === -1) break;
      if (!isSelfClosing(html, openEnd)) stack.push(at);
      i = openEnd;
      continue;
    }
    i = at + 1;
  }
  return closes;
}

interface Rope {
  parts: Array<string | Rope>;
  brace: boolean;
  dirty: boolean;
  blank: boolean;
  len: number;
}

interface PieceFlags {
  brace: boolean;
  dirty: boolean;
  blank: boolean;
  len: number;
}

/** `{` can open a token. `&` can be a character reference. Both need the joined text. */
function pieceFlags(text: string): PieceFlags {
  let brace = false;
  let dirty = false;
  let blank = true;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "{") brace = true;
    else if (char === "&") dirty = true;
    if (blank && !/\s/.test(char)) blank = false;
    if (brace && dirty && !blank) break;
  }
  if (text.length === 0) blank = true;
  return { brace, dirty, blank, len: text.length };
}

function flagsOf(parts: ReadonlyArray<string | Rope>): PieceFlags {
  let brace = false;
  let dirty = false;
  let blank = true;
  let len = 0;
  for (const part of parts) {
    const flags = typeof part === "string" ? pieceFlags(part) : part;
    brace = brace || flags.brace;
    dirty = dirty || flags.dirty;
    blank = blank && flags.blank;
    len += flags.len;
  }
  return { brace, dirty, blank, len };
}

function flattenRope(parts: ReadonlyArray<string | Rope>): string {
  const out: string[] = [];
  const lists: Array<ReadonlyArray<string | Rope>> = [parts];
  const index: number[] = [0];
  while (lists.length > 0) {
    const list = lists[lists.length - 1];
    const at = index[index.length - 1];
    if (at >= list.length) {
      lists.pop();
      index.pop();
      continue;
    }
    index[index.length - 1] = at + 1;
    const piece = list[at];
    if (typeof piece === "string") out.push(piece);
    else {
      lists.push(piece.parts);
      index.push(0);
    }
  }
  return out.join("");
}

/**
 * A closed chip's text. Nested chips are already ropes, so a chain of chips
 * that is not a token or a padding space is not joined until the root.
 */
function finishMergetag(parts: Array<string | Rope>): string | Rope {
  const flags = flagsOf(parts);
  if (!flags.brace && !flags.dirty) {
    if (flags.len === 0) return "";
    if (flags.blank) return " ";
    if (parts.length === 1) return parts[0];
    return { parts, ...flags };
  }
  return keptMergetagText(flattenRope(parts));
}

interface MergetagFrame {
  parts: Array<string | Rope>;
  closeStart: number;
  closeEnd: number;
}

/**
 * Remove a `<code data-bee-type="mergetag">` wrapper and keep the text inside
 * it. The editor turns a bare `{{ … }}` or `{% … %}` token in rich text into
 * a merge-tag span when the template loads, which is the shape BeeFree's HTML
 * export already leaves. A `<code>` without that attribute stays, including an
 * inline code sample and a `data-bee-type="speciallink"` wrapper. Run this
 * before `decodeEntitiesInTokens`: a token inside `data-bee-code` would
 * otherwise be decoded in the attribute and break its quotes. An opener with
 * no closer is left as written.
 */
export function unwrapMergeTagCode(html: string): string {
  if (html.indexOf("<") === -1) return html;
  const closes = indexCodeCloses(html);
  const root: Array<string | Rope> = [];
  const stack: MergetagFrame[] = [];
  const dest = (): Array<string | Rope> =>
    stack.length > 0 ? stack[stack.length - 1].parts : root;

  let i = 0;
  while (i < html.length) {
    const frame = stack.length > 0 ? stack[stack.length - 1] : undefined;
    const open = indexOfCodeOpen(
      html,
      i,
      frame ? frame.closeStart : html.length,
    );
    if (frame && open === -1) {
      if (i < frame.closeStart)
        frame.parts.push(html.slice(i, frame.closeStart));
      const inner = finishMergetag(frame.parts);
      stack.pop();
      dest().push(inner);
      i = frame.closeEnd;
      continue;
    }
    if (open === -1) {
      dest().push(html.slice(i));
      break;
    }
    const openEnd = endOfTag(html, open);
    if (openEnd === -1) {
      dest().push(html.slice(i));
      break;
    }
    dest().push(html.slice(i, open));
    if (!isMergetagOpen(html, open, openEnd)) {
      dest().push(html.slice(open, openEnd));
      i = openEnd;
      continue;
    }
    if (isSelfClosing(html, openEnd)) {
      i = openEnd;
      continue;
    }
    const close = closes.get(open);
    if (close === undefined) {
      dest().push(html.slice(open, openEnd));
      i = openEnd;
      continue;
    }
    stack.push({ parts: [], closeStart: close.start, closeEnd: close.end });
    i = openEnd;
  }
  return flattenRope(root);
}

/**
 * A `<code>` that only highlights one token leads with plain spaces that are
 * not part of the token. A non-breaking space stays. The element stays, and
 * so does a space after the token.
 * Nested markup inside the element is left as written.
 */
export function trimHighlightedTokenPadding(html: string): string {
  if (html.indexOf("<") === -1) return html;
  const closes = indexCodeCloses(html);
  const parts: string[] = [];
  let i = 0;
  while (i < html.length) {
    const open = indexOfCodeOpen(html, i);
    if (open === -1) {
      parts.push(html.slice(i));
      break;
    }
    const openEnd = endOfTag(html, open);
    if (openEnd === -1) {
      parts.push(html.slice(i));
      break;
    }
    parts.push(html.slice(i, openEnd));
    if (isSelfClosing(html, openEnd)) {
      i = openEnd;
      continue;
    }
    const close = closes.get(open);
    if (close === undefined) {
      i = openEnd;
      continue;
    }
    const inner = html.slice(openEnd, close.start);
    parts.push(inner.includes("<") ? inner : withoutLeadingTokenPadding(inner));
    parts.push(html.slice(close.start, close.end));
    i = close.end;
  }
  return parts.join("");
}
