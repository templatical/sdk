import { Parser, Tokenizer } from "htmlparser2";
import { isSafeUrlAttribute } from "@templatical/types";

const ALLOWED_TAGS = new Set([
  "p",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
  "br",
  "span",
]);

interface Markup {
  /** Every opening and closing tag name, lower-cased. */
  tags: string[];
  /** The raw text of every tag, comment, CDATA section and declaration. */
  tokens: string[];
  /** The raw text of every comment, CDATA section and declaration. */
  comments: string[];
  /** The raw value of every `style` attribute, character references undecoded. */
  styles: string[];
  /** The input ends inside a tag. */
  unterminated: boolean;
}

/**
 * Read every piece of markup the way the tokenizer splits it, before the
 * parser repairs or discards anything. Comments, CDATA sections (which
 * browsers read as a comment that ends at the first `>`), declarations and
 * processing instructions are collected whole.
 */
function scanMarkup(html: string): Markup {
  const markup: Markup = {
    tags: [],
    tokens: [],
    comments: [],
    styles: [],
    unterminated: false,
  };
  let openTag = -1;
  let attribute = "";
  let attributeValue = "";
  let covered = 0;
  const startOf = (index: number) =>
    Math.max(0, html.lastIndexOf("<", index - 1));
  const endOf = (index: number) => {
    const end = html.indexOf(">", index);
    return end < 0 ? html.length : end + 1;
  };
  const token = (start: number, end: number) => {
    const raw = html.slice(start, end);
    markup.tokens.push(raw);
    covered = end;
    return raw;
  };
  const comment = (start: number, endIndex: number) => {
    markup.comments.push(token(startOf(start), endOf(endIndex)));
  };
  const endTag = (endIndex: number) => {
    token(openTag, endIndex + 1);
    openTag = -1;
  };
  const ignore = () => {};
  const tokenizer = new Tokenizer(
    { decodeEntities: false },
    {
      onopentagname(start, endIndex) {
        markup.tags.push(html.slice(start, endIndex).toLowerCase());
        openTag = start - 1;
      },
      onopentagend: endTag,
      onselfclosingtag: endTag,
      onclosetag(start, endIndex) {
        markup.tags.push(html.slice(start, endIndex).toLowerCase());
        if (html.indexOf(">", endIndex) < 0) markup.unterminated = true;
        token(startOf(start), endOf(endIndex));
      },
      oncdata: comment,
      oncomment: comment,
      ondeclaration: comment,
      onprocessinginstruction: comment,
      ontext(_start, endIndex) {
        covered = endIndex;
      },
      ontextentity(_codepoint, endIndex) {
        covered = endIndex;
      },
      onattribname(start, endIndex) {
        attribute = html.slice(start, endIndex).toLowerCase();
        attributeValue = "";
      },
      onattribdata(start, endIndex) {
        attributeValue += html.slice(start, endIndex);
      },
      onattribentity: ignore,
      onattribend() {
        if (attribute === "style") markup.styles.push(attributeValue);
        attribute = "";
      },
      onend: ignore,
    },
  );
  tokenizer.write(html);
  tokenizer.end();
  // The tokenizer drops a tag the input ends inside of; a browser reads the
  // markup that follows the string into it.
  if (openTag >= 0) covered = openTag;
  if (covered < html.length) {
    markup.unterminated = true;
    markup.tokens.push(html.slice(covered));
  }
  return markup;
}

/**
 * Check restored rich text, after the exact placeholder check and unmasking.
 * A comment, CDATA section or declaration passes only when `source`, the
 * field's default, carries the same one byte for byte. So does every `style`
 * attribute value, which could otherwise add a remote fetch or an overlay.
 */
export function isSafeTranslationHtml(html: string, source = ""): boolean {
  const markup = scanMarkup(html);
  if (markup.unterminated || markup.tags.some((tag) => !ALLOWED_TAGS.has(tag)))
    return false;
  const sourceComments = new Set(scanMarkup(source).comments);
  if (markup.comments.some((comment) => !sourceComments.has(comment)))
    return false;
  const sourceStyles = new Set(scanMarkup(source).styles);
  if (markup.styles.some((style) => !sourceStyles.has(style))) return false;
  let safe = true;
  const parser = new Parser({
    onopentag(_name, attributes) {
      for (const [attribute, value] of Object.entries(attributes)) {
        if (attribute.startsWith("on") || !isSafeUrlAttribute(attribute, value))
          safe = false;
      }
    },
  });
  parser.end(html);
  return safe;
}

/** The tokens of a restored `text` field that its default doesn't carry. */
function foreignTokens(text: string, source: string): string[] {
  const sourceTokens = new Set(scanMarkup(source).tokens);
  return scanMarkup(text).tokens.filter((token) => !sourceTokens.has(token));
}

/**
 * Check a restored `text` field, whose value can reach a sink that doesn't
 * escape it: every tag, comment, CDATA section or declaration in it must
 * also be in `source`, the field's default, byte for byte.
 */
export function isSafeTranslationText(text: string, source: string): boolean {
  return foreignTokens(text, source).length === 0;
}

/**
 * Whether a `text` field that `isSafeTranslationText` refuses holds a `<`
 * directly before a letter, which reads as the start of a tag: the usual
 * cause is a comparison such as `a<b`.
 */
export function hasMarkupLikeLessThan(text: string, source: string): boolean {
  return foreignTokens(text, source).some((token) => /^<[A-Za-z]/.test(token));
}
