import {
  RICH_TEXT_SPACING,
  findOpenTagEnd,
  formatFontFamilies,
  isSection,
  isWrapper,
  parseFontFamilies,
  quoteFontFamily,
} from "@templatical/types";
import type { Block, ContentDirection } from "@templatical/types";

/**
 * Marks the `mj-text` of a block whose content is editor-authored rich text
 * (paragraph and title). MJML puts a `css-class` on the wrapping `<td>`, which
 * is what {@link richTextStylesheet} scopes its selectors to.
 *
 * The scope is the point. A bare `p { … }` rule would also reach an `html`
 * block — the renderer puts consumer markup in `mj-text` too — and the editor
 * previews those in a sandboxed `srcdoc` iframe on UA defaults. Styling them
 * would trade this mismatch for another one, and an inlined declaration would
 * beat the consumer's own stylesheet.
 */
export const RICH_TEXT_CSS_CLASS = "tpl-rich-text";

/**
 * The class carrying one specific paragraph gap, e.g. `tpl-rich-text-8`.
 *
 * Every rich-text block gets one of these *instead of* a shared paragraph rule.
 * That is a hard constraint, not a preference: `.tpl-rich-text p` and
 * `.tpl-rich-text-4 p` have identical specificity (one class, one type), so a
 * surviving base rule would win on source order and flatten every per-block gap
 * back to the default.
 */
export function richTextGapClass(gap: number): string {
  return `${RICH_TEXT_CSS_CLASS}-${gap}`;
}

/**
 * The global rules that make exported rich text match the editor canvas.
 *
 * Two gaps they close, neither visible until you measure the delivered email:
 *
 * - MJML's core skeleton injects `p { display:block;margin:13px 0; }` into
 *   every document. Against the canvas's paragraph gap that made a
 *   three-paragraph block 99px in the editor and 135px in the inbox — 13px
 *   above the first paragraph, 13px below the last, and 13px rather than 8px
 *   between each (issue #616).
 * - The skeleton resets nothing for `ul` / `ol` / `li`, so those fall through
 *   to each client's UA stylesheet — around 14px margin and a 40px bullet
 *   indent in Chromium, against the canvas's 8px and 24px. Unlike the
 *   paragraph case the value is not even a fixed constant, so matching MJML in
 *   the editor could not have fixed it.
 *
 * Emitted inside `<mj-style inline="inline">`, so MJML runs it through juice
 * and the declarations land as real inline styles. That matters twice: they
 * survive a client that strips `<style>` from the head, and juice resolves
 * `:last-child` structurally at build time instead of dropping it.
 *
 * One paragraph rule per *distinct* gap in the document, so a template using
 * two gaps costs two rules rather than one per block. The list values stay on
 * the unversioned class: MJML resets nothing for `ul`/`ol`/`li`, so they exist
 * to pin down client defaults rather than to be designed with.
 */
export function richTextStylesheet(
  gaps: number[],
  direction: ContentDirection = "ltr",
): string {
  const s = RICH_TEXT_SPACING;
  const scope = `.${RICH_TEXT_CSS_CLASS}`;
  const distinct = [...new Set(gaps)].sort((a, b) => a - b);

  const paragraphRules = distinct.flatMap((gap) => {
    const gapScope = `.${richTextGapClass(gap)}`;
    return [
      `${gapScope} p { margin: 0 0 ${gap}px; }`,
      `${gapScope} p:last-child { margin-bottom: 0; }`,
    ];
  });

  // Physical sides: Outlook does not honour `padding-inline-start`.
  const listPaddingSide =
    direction === "rtl" ? "padding-right" : "padding-left";

  return [
    ...paragraphRules,
    `${scope} ul, ${scope} ol { margin: ${s.listMarginY}px 0; ${listPaddingSide}: ${s.listPaddingLeft}px; }`,
    `${scope} li { margin: ${s.listItemMarginY}px 0; }`,
  ].join("\n      ");
}

/**
 * The paragraph gap a block asks for, or the built-in default.
 *
 * The fallback must produce a *rule* rather than nothing: silence hands the
 * paragraph back to MJML's `p { margin: 13px 0 }` skeleton default and reopens
 * the canvas/export mismatch. `0` is a legitimate gap, so this tests for
 * absence rather than falsiness.
 *
 * Mirrored on the canvas side by `getBlockWrapperStyle` in
 * `@templatical/editor`.
 */
export function resolveParagraphGap(spacing: number | undefined): number {
  return spacing ?? RICH_TEXT_SPACING.paragraphGap;
}

/**
 * Every paragraph gap the document uses, so the head can carry a rule for each.
 *
 * Walks section columns and wrapper children too — a paragraph inside a column
 * or a layout card needs its rule as much as a top-level one. Titles always
 * use the default gap: their content is normally a single paragraph the
 * renderer unwraps, and the multi-paragraph case is an edge worth spacing
 * consistently rather than configuring.
 */
export function collectParagraphGaps(blocks: Block[]): number[] {
  const gaps: number[] = [RICH_TEXT_SPACING.paragraphGap];

  const visit = (block: Block): void => {
    if (block.type === "paragraph") {
      gaps.push(resolveParagraphGap(block.paragraphSpacing));
    }
    if (isSection(block)) {
      for (const column of block.children) {
        for (const child of column) {
          visit(child);
        }
      }
    } else if (isWrapper(block)) {
      for (const child of block.children) {
        visit(child);
      }
    }
  };

  for (const block of blocks) {
    visit(block);
  }

  return gaps;
}

/**
 * The named references {@link decodeStyleReferences} writes out. `<` and `>`
 * stay encoded, named or numeric: MJML parses its source as XML, which forbids
 * a raw `<` in an attribute, and no CSS value needs one.
 */
const NAMED_STYLE_REFERENCES: Record<string, string> = {
  apos: "'",
  quot: '"',
  nbsp: String.fromCharCode(0xa0),
  semi: ";",
};

const STYLE_REFERENCE = /&(?:#(\d+)|#x([0-9a-f]+)|(apos|quot|nbsp|semi));/gi;
const STYLE_REFERENCE_AT = /^&(?:#(\d+)|#x([0-9a-f]+)|(apos|quot|nbsp|semi));/i;
const TAG_NAME_START = /[a-z]/i;
const HTML_SPACE = /[ \t\n\f\r]/;

function styleCharAt(
  style: string,
  index: number,
): { char: string; end: number; reference: boolean } | null {
  if (index >= style.length) return null;
  const reference =
    style[index] === "&" ? STYLE_REFERENCE_AT.exec(style.slice(index)) : null;
  return {
    char: reference
      ? decodeStyleReference(
          reference[0],
          "",
          reference[1],
          reference[2],
          reference[3],
        )
      : style[index],
    end: index + (reference?.[0].length ?? 1),
    reference: reference !== null,
  };
}

function decodeStyleReference(
  reference: string,
  quote: string,
  decimal: string | undefined,
  hex: string | undefined,
  name: string | undefined,
): string {
  let char: string;
  if (name !== undefined) {
    char = NAMED_STYLE_REFERENCES[name.toLowerCase()];
  } else {
    const codePoint = Number(decimal ?? `0x${hex}`);
    const valid =
      codePoint > 0 &&
      codePoint <= 0x10ffff &&
      !(codePoint >= 0xd800 && codePoint <= 0xdfff);
    if (!valid) return reference;
    char = String.fromCodePoint(codePoint);
  }
  // A raw `&` could start a reference, and the delimiter would end the
  // attribute; CSS reads either quote the same.
  if (char === "&") return "&amp;";
  if (char === "<" || char === ">") return reference;
  if (char === quote) return quote === '"' ? "'" : '"';
  return char;
}

/**
 * Apply a change to the first quoted style attribute on an opening tag.
 * Attributes are walked in order and quoted values skipped whole, so
 * `style="…"` text inside another attribute's value is never mistaken for it.
 */
function transformTagStyle(
  tag: string,
  transform: (value: string, quote: string) => string,
): string {
  let i = 1;
  while (i < tag.length && !HTML_SPACE.test(tag[i]) && tag[i] !== "/") i++;
  while (i < tag.length) {
    while (i < tag.length && (HTML_SPACE.test(tag[i]) || tag[i] === "/")) i++;
    const nameStart = i;
    while (i < tag.length && !/[\s=/]/.test(tag[i])) i++;
    const name = tag.slice(nameStart, i).toLowerCase();
    if (name === "") {
      i++;
      continue;
    }
    while (i < tag.length && HTML_SPACE.test(tag[i])) i++;
    if (tag[i] !== "=") continue;
    i++;
    while (i < tag.length && HTML_SPACE.test(tag[i])) i++;
    const quote = tag[i];
    if (quote === '"' || quote === "'") {
      const valueEnd = tag.indexOf(quote, i + 1);
      if (valueEnd === -1) return tag;
      if (name === "style") {
        const value = transform(tag.slice(i + 1, valueEnd), quote);
        return `${tag.slice(0, i + 1)}${value}${tag.slice(valueEnd)}`;
      }
      i = valueEnd + 1;
      continue;
    }
    while (i < tag.length && !HTML_SPACE.test(tag[i])) i++;
  }
  return tag;
}

/**
 * Walk opening tags outside comments, preserving all bytes except a changed
 * style attribute. The quote-aware tag scan keeps `>` inside attributes.
 */
function transformStyleAttributes(
  html: string,
  transform: (value: string, quote: string) => string,
): string {
  let out = "";
  let copied = 0;
  let open = html.indexOf("<");
  while (open !== -1) {
    // Outlook conditional markup is still a comment in the MJML source.
    if (html.startsWith("<!--", open)) {
      const commentEnd = html.indexOf("-->", open + 4);
      if (commentEnd === -1) break;
      open = html.indexOf("<", commentEnd + 3);
      continue;
    }
    if (!TAG_NAME_START.test(html.charAt(open + 1))) {
      open = html.indexOf("<", open + 1);
      continue;
    }
    const end = findOpenTagEnd(html, open + 1);
    if (end === -1) break;
    const tag = html.slice(open, end);
    const changed = transformTagStyle(tag, transform);
    if (changed !== tag) {
      out += html.slice(copied, open) + changed;
      copied = end;
    }
    open = html.indexOf("<", end);
  }
  return out + html.slice(copied);
}

/**
 * Decode character references in rich-text style attributes before MJML's
 * CSS inliner splits declarations on semicolons. Other attributes and text
 * remain as written; quotes switch to the attribute's opposite delimiter.
 */
export function decodeStyleReferences(html: string): string {
  if (!html.includes("&")) return html;
  return transformStyleAttributes(html, (value, quote) => {
    let out = "";
    let end = 0;
    let trailingBackslashes = 0;
    const append = (part: string): void => {
      out += part;
      for (const char of part) {
        trailingBackslashes = char === "\\" ? trailingBackslashes + 1 : 0;
      }
    };
    for (const match of value.matchAll(STYLE_REFERENCE)) {
      const [reference, decimal, hex, named] = match;
      const at = match.index ?? end;
      append(value.slice(end, at));
      const decoded = decodeStyleReference(reference, "", decimal, hex, named);
      append(
        decoded === quote && trailingBackslashes % 2 === 1
          ? quote === '"'
            ? "22 "
            : "27 "
          : decodeStyleReference(reference, quote, decimal, hex, named),
      );
      end = at + reference.length;
    }
    append(value.slice(end));
    return out;
  });
}

function decodeCssEscapes(value: string): string {
  return value.replace(
    /\\(?:([0-9a-f]{1,6})[ \t\n\r\f]?|([^\n\r\f]))/gi,
    (_escape, hex: string | undefined, char: string | undefined) => {
      if (hex === undefined) return char ?? "";
      const codePoint = Number.parseInt(hex, 16);
      return codePoint > 0 &&
        codePoint <= 0x10ffff &&
        !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : "\ufffd";
    },
  );
}

/** Resolve a font declaration without changing its surrounding CSS. */
function resolveFontDeclaration(
  declaration: string,
  quote: string,
  resolveFontFamily: (family: string, important: boolean) => string,
): string {
  const match = /^(\s*font-family\s*:\s*)([\s\S]*?)\s*$/i.exec(declaration);
  if (!match) return declaration;
  const value = match[2];
  const decoded = value.replace(
    STYLE_REFERENCE,
    (reference, decimal, hex, named) =>
      decodeStyleReference(reference, "", decimal, hex, named),
  );
  const priority = /\s*!\s*important$/i.exec(decoded)?.[0] ?? "";
  const familyValue = priority ? decoded.slice(0, -priority.length) : decoded;
  const unescaped = /^[\s]*['"]/.test(familyValue)
    ? familyValue
    : decodeCssEscapes(familyValue);
  const expanded = resolveFontFamily(unescaped, priority !== "");
  const resolved =
    expanded === unescaped && unescaped !== familyValue
      ? resolveFontFamily(
          parseFontFamilies(unescaped).length === 1 ||
            /^(?:inherit|initial|unset|revert|revert-layer)$/i.test(
              unescaped.trim(),
            )
            ? unescaped
            : quoteFontFamily(unescaped.trim()),
          priority !== "",
        )
      : expanded;
  if (resolved === familyValue) return declaration;

  // Re-quote any CSS family that uses the HTML attribute's delimiter;
  // entities would contain semicolons that MJML's CSS inliner treats as
  // declaration separators.
  const needsQuoting = quote === "'" || resolved.includes('"');
  const families = needsQuoting ? parseFontFamilies(resolved) : [];
  if (needsQuoting && families.length === 0) return declaration;
  const safe =
    quote === "'"
      ? families
          .map((family) =>
            family.quoted
              ? `"${family.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/'/g, "\\27 ")}"`
              : family.name,
          )
          .join(", ")
      : needsQuoting
        ? formatFontFamilies(families).replace(/"/g, "\\22 ")
        : resolved;
  return `${match[1]}${safe}${priority}${declaration.slice(match[1].length + value.length)}`;
}

/** Walk declarations with the same CSS separator rules used for font expansion. */
function transformStyleDeclarations(
  style: string,
  quote: string,
  transform: (declaration: string, quote: string) => string,
): string {
  let result = "";
  let start = 0;
  let cssQuote = "";
  let depth = 0;
  let escaped = false;
  for (let i = 0; i < style.length; i++) {
    const token = styleCharAt(style, i)!;
    const char = token.char;
    if (!cssQuote && !escaped && depth === 0 && char === "/") {
      const opener = styleCharAt(style, token.end);
      if (opener?.char === "*") {
        let cursor = opener.end;
        let previous = "";
        let closed = false;
        while (cursor < style.length) {
          const part = styleCharAt(style, cursor)!;
          if (previous === "*" && part.char === "/") {
            cursor = part.end;
            closed = true;
            break;
          }
          previous = part.char;
          cursor = part.end;
        }
        if (!closed) break;
        i = cursor - 1;
        continue;
      }
    }
    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === ";" && !cssQuote && depth === 0) {
      result += transform(style.slice(start, i), quote);
      result += style.slice(i, token.end);
      start = token.end;
    } else if (cssQuote) {
      if (char === cssQuote) cssQuote = "";
    } else if (char === '"' || char === "'") {
      cssQuote = char;
    } else if (char === "(") {
      depth++;
    } else if (char === ")" && depth > 0) {
      depth--;
    }
    i = token.end - 1;
  }
  result += transform(style.slice(start), quote);
  return result;
}

/** Expand only inline font-family declarations in editor-authored HTML. */
export function resolveInlineFontFamilies(
  html: string,
  resolveFontFamily: (family: string, important: boolean) => string,
): string {
  if (!/font-family/i.test(html)) return html;
  return transformStyleAttributes(html, (style, quote) =>
    transformStyleDeclarations(style, quote, (declaration, delimiter) =>
      resolveFontDeclaration(declaration, delimiter, resolveFontFamily),
    ),
  );
}

/** Ignore CSS comments while retaining quoted text for declaration matching. */
function withoutCssComments(value: string): string {
  let result = "";
  let quote = "";
  let escaped = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (!quote && char === "/" && value[i + 1] === "*") {
      const end = value.indexOf("*/", i + 2);
      if (end === -1) break;
      result += " ";
      i = end + 1;
      continue;
    }
    result += char;
    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (quote && char === quote) {
      quote = "";
    } else if (!quote && (char === '"' || char === "'")) {
      quote = char;
    }
  }
  return result;
}

const FONT_SIZE_UNIT =
  "(?:px|cm|mm|q|in|pc|pt|em|ex|ch|rem|lh|rlh|cap|ic|(?:s|l|d)?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max)|%)";
const FONT_SHORTHAND_FAMILY = new RegExp(
  `(?:^|\\s)(?:\\d*\\.?\\d+${FONT_SIZE_UNIT}|xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)(?:\\s*\\/\\s*(?:normal|\\d*\\.?\\d+(?:[a-z]+|%)?))?\\s+(.+)$`,
  "i",
);

/** The winning paragraph font, including a `font` shorthand that resets it. */
export function effectiveInlineFontFamily(
  openTag: string,
  resolveFontFamily: (family: string) => string,
): string | undefined {
  let family: string | undefined;
  let important = false;
  transformStyleAttributes(openTag, (style, quote) => {
    transformStyleDeclarations(style, quote, (declaration) => {
      const match = /^\s*(font-family|font)\s*:\s*([\s\S]*?)\s*$/i.exec(
        withoutCssComments(declaration),
      );
      if (!match) return declaration;
      const priority = /\s*!\s*important\s*$/i.exec(match[2]);
      const value = priority
        ? match[2].slice(0, priority.index).trim()
        : match[2].trim();
      const isShorthand = match[1].toLowerCase() === "font";
      const wideValue = /^(?:inherit|initial|unset|revert|revert-layer)$/i.test(
        value,
      );
      const shorthand =
        isShorthand && !wideValue ? FONT_SHORTHAND_FAMILY.exec(value) : null;
      const candidate = isShorthand && !wideValue ? shorthand?.[1] : value;
      if (
        isShorthand &&
        !wideValue &&
        parseFontFamilies(candidate).length === 0
      ) {
        return declaration;
      }
      if (candidate && (!important || priority)) {
        family = resolveFontFamily(candidate);
        important = Boolean(priority);
      }
      return declaration;
    });
    return style;
  });
  return family && important ? `${family} !important` : family;
}
