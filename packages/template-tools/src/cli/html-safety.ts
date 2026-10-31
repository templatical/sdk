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
    unterminated: false,
  };
  let openTag = -1;
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
      onattribdata: ignore,
      onattribentity: ignore,
      onattribend: ignore,
      onattribname: ignore,
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
 * field's default, carries the same one byte for byte.
 */
export function isSafeTranslationHtml(html: string, source = ""): boolean {
  const markup = scanMarkup(html);
  if (markup.unterminated || markup.tags.some((tag) => !ALLOWED_TAGS.has(tag)))
    return false;
  const sourceComments = new Set(scanMarkup(source).comments);
  if (markup.comments.some((comment) => !sourceComments.has(comment)))
    return false;
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

/**
 * Check a restored `text` field, whose value can reach a sink that doesn't
 * escape it: every tag, comment, CDATA section or declaration in it must
 * also be in `source`, the field's default, byte for byte.
 */
export function isSafeTranslationText(text: string, source: string): boolean {
  const sourceTokens = new Set(scanMarkup(source).tokens);
  return scanMarkup(text).tokens.every((token) => sourceTokens.has(token));
}
